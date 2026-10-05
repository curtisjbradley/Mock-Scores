import type { IStandingsTeam } from '@mock-scores/shared';

/**
 * Sample tournament results used by the live standings preview / docs playground.
 *
 * Shaped to exercise interesting tiebreaker scenarios:
 * - A and B are tied on wins; A beat B head-to-head.
 * - E and G are a perfect mirror (same wins, PF, PA) — only alpha/when-tied splits them.
 * - D is the clear top team; a couple of ballot ties appear in the data.
 */
export const dummyTeams: IStandingsTeam[] = [
  {
    name: 'Team A', code: 'A',
    pairings: [
      { opponent: 'B', ballots: [{ pointsFor: 185, pointsAgainst: 172 }, { pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'C', ballots: [{ pointsFor: 190, pointsAgainst: 165 }, { pointsFor: 188, pointsAgainst: 170 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'D', ballots: [{ pointsFor: 175, pointsAgainst: 182 }, { pointsFor: 173, pointsAgainst: 179 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'E', ballots: [{ pointsFor: 183, pointsAgainst: 176 }, { pointsFor: 179, pointsAgainst: 174 }], won_presider_tiebreaker: true, num_scorers: 2 },
    ],
  },
  {
    name: 'Team B', code: 'B',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 172, pointsAgainst: 185 }, { pointsFor: 180, pointsAgainst: 180 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'C', ballots: [{ pointsFor: 178, pointsAgainst: 178 }, { pointsFor: 182, pointsAgainst: 171 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'E', ballots: [{ pointsFor: 191, pointsAgainst: 168 }, { pointsFor: 187, pointsAgainst: 172 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'F', ballots: [{ pointsFor: 184, pointsAgainst: 169 }, { pointsFor: 180, pointsAgainst: 175 }], won_presider_tiebreaker: true, num_scorers: 2 },
    ],
  },
  {
    name: 'Team C', code: 'C',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 165, pointsAgainst: 190 }, { pointsFor: 170, pointsAgainst: 188 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'B', ballots: [{ pointsFor: 178, pointsAgainst: 178 }, { pointsFor: 171, pointsAgainst: 182 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'D', ballots: [{ pointsFor: 186, pointsAgainst: 174 }, { pointsFor: 183, pointsAgainst: 170 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'F', ballots: [{ pointsFor: 168, pointsAgainst: 185 }, { pointsFor: 165, pointsAgainst: 190 }], won_presider_tiebreaker: false, num_scorers: 2 },
    ],
  },
  {
    name: 'Team D', code: 'D',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 182, pointsAgainst: 175 }, { pointsFor: 179, pointsAgainst: 173 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'C', ballots: [{ pointsFor: 174, pointsAgainst: 186 }, { pointsFor: 170, pointsAgainst: 183 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'E', ballots: [{ pointsFor: 188, pointsAgainst: 171 }, { pointsFor: 185, pointsAgainst: 168 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'F', ballots: [{ pointsFor: 192, pointsAgainst: 163 }, { pointsFor: 189, pointsAgainst: 166 }], won_presider_tiebreaker: true, num_scorers: 2 },
    ],
  },
  {
    name: 'Team E', code: 'E',
    pairings: [
      { opponent: 'A', ballots: [{ pointsFor: 176, pointsAgainst: 183 }, { pointsFor: 174, pointsAgainst: 179 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'B', ballots: [{ pointsFor: 168, pointsAgainst: 191 }, { pointsFor: 172, pointsAgainst: 187 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'D', ballots: [{ pointsFor: 171, pointsAgainst: 188 }, { pointsFor: 168, pointsAgainst: 185 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'G', ballots: [{ pointsFor: 180, pointsAgainst: 170 }, { pointsFor: 175, pointsAgainst: 165 }], won_presider_tiebreaker: true, num_scorers: 2 },
    ],
  },
  {
    name: 'Team F', code: 'F',
    pairings: [
      { opponent: 'B', ballots: [{ pointsFor: 169, pointsAgainst: 184 }, { pointsFor: 175, pointsAgainst: 180 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'C', ballots: [{ pointsFor: 185, pointsAgainst: 168 }, { pointsFor: 190, pointsAgainst: 165 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'D', ballots: [{ pointsFor: 163, pointsAgainst: 192 }, { pointsFor: 166, pointsAgainst: 189 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'G', ballots: [{ pointsFor: 182, pointsAgainst: 171 }, { pointsFor: 178, pointsAgainst: 167 }], won_presider_tiebreaker: true, num_scorers: 2 },
    ],
  },
  {
    name: 'Team G', code: 'G',
    pairings: [
      { opponent: 'E', ballots: [{ pointsFor: 170, pointsAgainst: 180 }, { pointsFor: 165, pointsAgainst: 175 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'F', ballots: [{ pointsFor: 171, pointsAgainst: 182 }, { pointsFor: 167, pointsAgainst: 178 }], won_presider_tiebreaker: false, num_scorers: 2 },
      { opponent: 'C', ballots: [{ pointsFor: 177, pointsAgainst: 163 }, { pointsFor: 174, pointsAgainst: 160 }], won_presider_tiebreaker: true, num_scorers: 2 },
      { opponent: 'D', ballots: [{ pointsFor: 160, pointsAgainst: 195 }, { pointsFor: 158, pointsAgainst: 192 }], won_presider_tiebreaker: false, num_scorers: 2 },
    ],
  },
];
