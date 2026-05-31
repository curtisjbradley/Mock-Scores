export interface Ballot {
  pointsFor: number;
  pointsAgainst: number;
}

export interface Pairing {
  opponent: string; // team code
  ballots: Ballot[];
  won_presider_tiebreaker: boolean;
}

export interface DummyTeam {
  name: string;
  code: string;
  pairings: Pairing[];
}

export const dummyTeams: DummyTeam[] = [
  {
    // 3 wins — tied with B on wins, beat B head-to-head
    name: 'Team A', code: 'A',
    pairings: [
      { opponent: 'B', ballots: [{ pointsFor: 185, pointsAgainst: 172 }, { pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: true },  // ballot tie in game 2
      { opponent: 'C', ballots: [{ pointsFor: 190, pointsAgainst: 165 }, { pointsFor: 188, pointsAgainst: 170 }], won_presider_tiebreaker: true },
      { opponent: 'D', ballots: [{ pointsFor: 175, pointsAgainst: 182 }, { pointsFor: 173, pointsAgainst: 179 }], won_presider_tiebreaker: false },
      { opponent: 'E', ballots: [{ pointsFor: 183, pointsAgainst: 176 }, { pointsFor: 179, pointsAgainst: 174 }], won_presider_tiebreaker: true },
    ],
  },
  {
    // 3 wins — tied with A on wins, lost to A head-to-head
    name: 'Team B', code: 'B',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 172, pointsAgainst: 185 }, { pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: false }, // ballot tie in game 2
      { opponent: 'C', ballots: [{ pointsFor: 178, pointsAgainst: 178 }, { pointsFor: 182, pointsAgainst: 171 }], won_presider_tiebreaker: true },  // ballot tie in game 1
      { opponent: 'E', ballots: [{ pointsFor: 191, pointsAgainst: 168 }, { pointsFor: 187, pointsAgainst: 172 }], won_presider_tiebreaker: true },
      { opponent: 'F', ballots: [{ pointsFor: 184, pointsAgainst: 169 }, { pointsFor: 180, pointsAgainst: 175 }], won_presider_tiebreaker: true },
    ],
  },
  {
    // 1 win
    name: 'Team C', code: 'C',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 165, pointsAgainst: 190 }, { pointsFor: 170, pointsAgainst: 188 }], won_presider_tiebreaker: false },
      { opponent: 'B', ballots: [{ pointsFor: 178, pointsAgainst: 178 }, { pointsFor: 171, pointsAgainst: 182 }], won_presider_tiebreaker: false }, // ballot tie in game 1
      { opponent: 'D', ballots: [{ pointsFor: 186, pointsAgainst: 174 }, { pointsFor: 183, pointsAgainst: 170 }], won_presider_tiebreaker: true },
      { opponent: 'F', ballots: [{ pointsFor: 168, pointsAgainst: 185 }, { pointsFor: 165, pointsAgainst: 190 }], won_presider_tiebreaker: false },
    ],
  },
  {
    // 4 wins — top team
    name: 'Team D', code: 'D',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 182, pointsAgainst: 175 }, { pointsFor: 179, pointsAgainst: 173 }], won_presider_tiebreaker: true },
      { opponent: 'C', ballots: [{ pointsFor: 174, pointsAgainst: 186 }, { pointsFor: 170, pointsAgainst: 183 }], won_presider_tiebreaker: false },
      { opponent: 'E', ballots: [{ pointsFor: 188, pointsAgainst: 171 }, { pointsFor: 185, pointsAgainst: 168 }], won_presider_tiebreaker: true },
      { opponent: 'F', ballots: [{ pointsFor: 192, pointsAgainst: 163 }, { pointsFor: 189, pointsAgainst: 166 }], won_presider_tiebreaker: true },
    ],
  },
  {
    // 1 win — exactly tied with G on everything (same wins, same PF, same PA)
    name: 'Team E', code: 'E',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 176, pointsAgainst: 183 }, { pointsFor: 174, pointsAgainst: 179 }], won_presider_tiebreaker: false },
      { opponent: 'B', ballots: [{ pointsFor: 168, pointsAgainst: 191 }, { pointsFor: 172, pointsAgainst: 187 }], won_presider_tiebreaker: false },
      { opponent: 'D', ballots: [{ pointsFor: 171, pointsAgainst: 188 }, { pointsFor: 168, pointsAgainst: 185 }], won_presider_tiebreaker: false },
      { opponent: 'G', ballots: [{ pointsFor: 180, pointsAgainst: 170 }, { pointsFor: 175, pointsAgainst: 165 }], won_presider_tiebreaker: true },
    ],
  },
  {
    // 2 wins
    name: 'Team F', code: 'F',
    pairings: [
      { opponent: 'B', ballots: [{ pointsFor: 169, pointsAgainst: 184 }, { pointsFor: 175, pointsAgainst: 180 }], won_presider_tiebreaker: false },
      { opponent: 'C', ballots: [{ pointsFor: 185, pointsAgainst: 168 }, { pointsFor: 190, pointsAgainst: 165 }], won_presider_tiebreaker: true },
      { opponent: 'D', ballots: [{ pointsFor: 163, pointsAgainst: 192 }, { pointsFor: 166, pointsAgainst: 189 }], won_presider_tiebreaker: false },
      { opponent: 'G', ballots: [{ pointsFor: 182, pointsAgainst: 171 }, { pointsFor: 178, pointsAgainst: 167 }], won_presider_tiebreaker: true },
    ],
  },
  {
    // 1 win — exactly tied with E on wins, PF, PA (perfect mirror)
    name: 'Team G', code: 'G',
    pairings: [
      { opponent: 'E', ballots: [{ pointsFor: 170, pointsAgainst: 180 }, { pointsFor: 165, pointsAgainst: 175 }], won_presider_tiebreaker: false },
      { opponent: 'F', ballots: [{ pointsFor: 171, pointsAgainst: 182 }, { pointsFor: 167, pointsAgainst: 178 }], won_presider_tiebreaker: false },
      { opponent: 'C', ballots: [{ pointsFor: 177, pointsAgainst: 163 }, { pointsFor: 174, pointsAgainst: 160 }], won_presider_tiebreaker: true },
      { opponent: 'D', ballots: [{ pointsFor: 160, pointsAgainst: 195 }, { pointsFor: 158, pointsAgainst: 192 }], won_presider_tiebreaker: false },
    ],
  },
];
