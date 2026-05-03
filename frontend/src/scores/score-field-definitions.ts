//TODO: Fix Name
interface IScoreValidValues {
    scoreMin: number,
    scoreMax: number
    scoreMultiplier: number
}

interface IScoreDefinition {
    validValues : IScoreValidValues
    categoryName : string,
}

interface ITournamentStructure{
    scoringPossibilities : IScoreDefinition[]
}


export type { IScoreValidValues , IScoreDefinition, ITournamentStructure }