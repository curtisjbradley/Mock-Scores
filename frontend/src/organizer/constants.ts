export type OrganizerTab = 'tournament' | 'teams' | 'scorers' | 'courtrooms' | 'organizers' | 'witnesses' | 'scoring' | 'rounds' | 'standings' | 'tiebreakers' | 'awards'
export type OrganizerScreen = 'overview' | 'structure' | OrganizerTab

export const VALID_SCREENS = new Set<string>([
    'overview', 'structure', 'tournament', 'teams', 'scorers', 'courtrooms',
    'organizers', 'witnesses', 'scoring', 'rounds', 'standings', 'tiebreakers', 'awards',
])
