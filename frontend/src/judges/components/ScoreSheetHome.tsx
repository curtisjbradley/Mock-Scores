import { Suspense, useState } from "react";
import ScoreSheet from "./ScoreSheet.tsx";
import ConflictCheck from "./ConflictCheck.tsx";
import TiebreakerOnly from "./TiebreakerOnly.tsx";
import { EXAMPLE_TRIAL_DETAILS } from "../data.ts";
import { useParams } from 'react-router-dom';
import NotFound from "../../NotFound.tsx";
import LoadingPage from "../../components/LoadingPage.tsx";


/**
 * Top-level routing component for the scoring flow.
 * 1. Shows `ConflictCheck` until the scorer confirms no conflicts.
 * 2. If the user is a presider with `presiderTiebreakerOnly`, shows `TiebreakerOnly`.
 * 3. Otherwise, shows the full `ScoreSheet`.
 */
const ScoreSheetHome = () => {
    const [proceeded, setProceeded] = useState(false);
    const {scorerID} = useParams<{scorerID : string}>();

    if (!scorerID) {
        return <NotFound />;
    }


    const details = { ...EXAMPLE_TRIAL_DETAILS, tournamentID: scorerID };
    const storageKey = `mock-trial-scores-${details.trialID}-${details.scorerID}`;

    if (!proceeded) {
        return <ConflictCheck details={details} onProceed={() => setProceeded(true)} />;
    }

    if (details.isPresider && details.presiderTiebreakerOnly) {
        return <TiebreakerOnly details={details} storageKey={storageKey} />;
    }

    return (
        <Suspense fallback={<LoadingPage />}>
            <ScoreSheet {...details} />
        </Suspense>
    );
};

export default  ScoreSheetHome;
