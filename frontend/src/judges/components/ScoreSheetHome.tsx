import { Suspense, useState } from "react";
import ScoreSheet from "./ScoreSheet.tsx";
import ConflictCheck from "./ConflictCheck.tsx";
import TiebreakerOnly from "./TiebreakerOnly.tsx";
import { EXAMPLE_TRIAL_DETAILS } from "../data.ts";

interface IScoreSheetProps {
    /** Tournament ID injected at the entry point; overrides the value in example data. */
    tournamentId: string;
}

/**
 * Top-level routing component for the scoring flow.
 * 1. Shows `ConflictCheck` until the scorer confirms no conflicts.
 * 2. If the user is a presider with `presiderTiebreakerOnly`, shows `TiebreakerOnly`.
 * 3. Otherwise shows the full `ScoreSheet`.
 */
const ScoreSheetHome = ({ tournamentId }: IScoreSheetProps) => {
    const [proceeded, setProceeded] = useState(false);
    const details = { ...EXAMPLE_TRIAL_DETAILS, tournamentID: tournamentId };
    const storageKey = `mock-trial-scores-${details.trialID}-${details.scorerID}`;

    if (!proceeded) {
        return <ConflictCheck details={details} onProceed={() => setProceeded(true)} />;
    }

    if (details.isPresider && details.presiderTiebreakerOnly) {
        return <TiebreakerOnly details={details} storageKey={storageKey} />;
    }

    return (
        <Suspense fallback={<p>Loading…</p>}>
            <ScoreSheet {...details} />
        </Suspense>
    );
};

export { ScoreSheetHome };
export type { IScoreSheetProps };
