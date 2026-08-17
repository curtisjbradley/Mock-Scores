export type OrganizerTab = 'tournament' | 'teams' | 'scorers' | 'courtrooms' | 'organizers' | 'witnesses' | 'scoring' | 'rounds' | 'standings' | 'tiebreakers' | 'awards'
export type OrganizerScreen = 'home' | 'structure' | OrganizerTab

export const VALID_SCREENS = new Set<string>([
    'home', 'structure', 'tournament', 'teams', 'scorers', 'courtrooms',
    'organizers', 'witnesses', 'scoring', 'rounds', 'standings', 'tiebreakers', 'awards',
])
