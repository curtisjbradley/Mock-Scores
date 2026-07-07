import { Suspense, useEffect, useState } from "react";
import ScoreSheet from "./ScoreSheet.tsx";
import ConflictCheck from "./ConflictCheck.tsx";
import TiebreakerOnly from "./TiebreakerOnly.tsx";
import { useParams } from 'react-router-dom';
import NotFound from "../../error/NotFound.tsx";
import LoadingPage from "../../layout/LoadingPage.tsx";
import type { IScoreSheetFormat } from "@mock-scores/shared";

const ScoreSheetHome = () => {
    const { scorerID } = useParams<{ scorerID: string }>();
    const [data, setData] = useState<IScoreSheetFormat | null>(null);
    const [loading, setLoading] = useState(true);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [conflictReported, setConflictReported] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [proceeded, setProceeded] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!scorerID) return;
        fetch(`/api/score/${scorerID}`)
            .then(async r => {
                if (r.status === 410) { setAlreadySubmitted(true); return; }
                if (r.status === 409) { setConflictReported(true); return; }
                if (r.status === 404) { setError('not_found'); return; }
                if (!r.ok) { setError('error'); return; }
                setData(await r.json());
            })
            .catch(() => setError('error'))
            .finally(() => setLoading(false));
    }, [scorerID]);

    if (!scorerID) return <NotFound />;
    if (loading) return <LoadingPage />;

    if (alreadySubmitted) {
        return (
            <div className="conflict-check">
                <div className="conflict-card">
                    <h1 className="conflict-title">Link No Longer Valid</h1>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                        A ballot has already been submitted using this link.
                        If you believe this is an error, please contact the tournament organizer.
                    </p>
                </div>
            </div>
        );
    }

    if (conflictReported) {
        return (
            <div className="conflict-check">
                <div className="conflict-card">
                    <h1 className="conflict-title">Conflict Reported</h1>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                        You have reported a conflict of interest for this assignment.
                        The organizer has been notified. Please do not score this round.
                    </p>
                </div>
            </div>
        );
    }

    if (error === 'not_found' || (!data && !loading)) return <NotFound />;

    if (error) {
        return (
            <div className="conflict-check">
                <div className="conflict-card">
                    <h1 className="conflict-title">Something Went Wrong</h1>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                        We couldn't load your scoresheet. Please check your link and try again.
                        If the problem continues, contact the tournament organizer.
                    </p>
                </div>
            </div>
        );
    }

    if (!data) return <NotFound />;

    const storageKey = `mock-trial-scores-${data.pairingID}-${data.scorer.scorerID}`;

    if (submitted) {
        return (
            <div className="conflict-check">
                <div className="conflict-card">
                    <h1 className="conflict-title">Submitted</h1>
                    <p style={{ color: "var(--text-muted)" }}>Your scoresheet has been recorded. Thank you!</p>
                </div>
            </div>
        );
    }

    // Paper scorers skip the conflict check — go straight to the ballot
    if (!proceeded && !data.scorer.isPaper) {
        return <ConflictCheck details={data} onProceed={() => setProceeded(true)} />;
    }

    if (data.ballotOptions.showTiebreaker && !data.ballotOptions.fillableScores) {
        return <TiebreakerOnly details={data} storageKey={storageKey} onSubmitSuccess={() => setSubmitted(true)} />;
    }

    return (
        <Suspense fallback={<LoadingPage loadingText="Loading scoresheet" />}>
            <ScoreSheet {...data} onSubmitSuccess={() => setSubmitted(true)} />
        </Suspense>
    );
};

export default ScoreSheetHome;
