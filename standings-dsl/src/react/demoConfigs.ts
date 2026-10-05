/**
 * Default DSL loaded into the docs playground: the AMTA standings template
 * (Ballots → Combined Strength → Point Differential → Opponent Combined
 * Strength). Kept in sync with the DB default template in
 * `backend/db/MockScoresDBDDLSetup.sql`.
 */
export const AMTA_DEMO_DSL = `(config
  (stat "Ballots" sum (+ (pairing ballots_won) (* (pairing ballots_tied) 0.5)))
  (stat "Combined Strength" sum (opponent "Ballots"))
  (stat "Point Differential" sum (- (pairing ballot_pf) (pairing ballot_pa)))
  (stat "Opponent Combined Strength" sum (opponent "Combined Strength"))
  (columns (column "Ballots" "Ballots") (column "Combined Strength" "CS") (column "Point Differential" "PD") (column "Opponent Combined Strength" "OCS"))
  (tiebreakers (by "Ballots" desc) (by "Combined Strength" desc) (by "Point Differential" desc) (by "Opponent Combined Strength" desc)))`;
