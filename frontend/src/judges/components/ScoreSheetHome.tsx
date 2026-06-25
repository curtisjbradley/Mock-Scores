import { Suspense, useState } from "react";
import ScoreSheet from "./ScoreSheet.tsx";
import ConflictCheck from "./ConflictCheck.tsx";
import TiebreakerOnly from "./TiebreakerOnly.tsx";
import { useParams } from 'react-router-dom';
import NotFound from "../../error/NotFound.tsx";
import LoadingPage from "../../layout/LoadingPage.tsx";
import { useApiFetch } from "../../shared/hooks/useApiFetch.ts";
import type { IScoreSheetFormat } from "@mock-scores/shared";

const ScoreSheetHome = () => {
    const { scorerID } = useParams<{ scorerID: string }>();
    const { data, loading, error } = useApiFetch<IScoreSheetFormat | null>(`/api/score/${scorerID ?? ''}`, null);
    const [proceeded, setProceeded] = useState(false);

    if (!scorerID) return <NotFound />;
    if (loading) return <LoadingPage />;
    if (error) return <><h1>Encountered an Error</h1><p>{error}</p><p>Please try again</p></>;
    if (!data) return <NotFound />;

    const storageKey = `mock-trial-scores-${data.pairingID}-${data.scorer.scorerID}`;

    if (!proceeded) {
        return <ConflictCheck details={data} onProceed={() => setProceeded(true)} />;
    }

    if (data.showTiebreaker && data.presiderTiebreakerOnly) {
        return <TiebreakerOnly details={data} storageKey={storageKey} />;
    }

    return (
        <Suspense fallback={<LoadingPage loadingText="Loading scoresheet" />}>
            <ScoreSheet {...data} />
        </Suspense>
    );
};

export default ScoreSheetHome;
