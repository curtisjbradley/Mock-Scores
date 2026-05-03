import {Suspense} from "react";
import ScoreSheetDetails from "./scoresheet-details.tsx";
import {EXAMPLE_TRIAL_DETAILS} from "./mock-scoresheet.ts";


const loadingScreen = () => {
    return (<p>
        Loading...
    </p>)
}

interface IScoreSheetProps {
    tournamentId: string
}

const ScoresheetHome = ({tournamentId} : IScoreSheetProps) => {
    return(
    <Suspense fallback={loadingScreen()}>
        <ScoreSheetDetails tournamentID={tournamentId} scoringCategories={EXAMPLE_TRIAL_DETAILS.scoringCategories} defense={EXAMPLE_TRIAL_DETAILS.defense} prosecution={EXAMPLE_TRIAL_DETAILS.prosecution} caseName={EXAMPLE_TRIAL_DETAILS.caseName} isCriminal={EXAMPLE_TRIAL_DETAILS.isCriminal}/>
    </Suspense>
    )
}

export {ScoresheetHome};
export type { IScoreSheetProps };
