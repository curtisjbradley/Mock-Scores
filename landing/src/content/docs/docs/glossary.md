---
title: Glossary
description: Definitions of mock trial and MockScores terms — presider, swing witness, call order, pairing, ballot, scorecard, and standings terminology.
sidebar:
  order: 5
---

This glossary defines the terms used throughout the MockScores documentation. Terms are grouped by where you encounter them.

## Roles

**Organizer** — The person who creates and manages a tournament. Organizers configure the case, scoring, awards, and standings; add teams, scorers, and courtrooms; build rounds and pairings; and publish results. See the [Organizer Guide](/docs/organizer/).

**Coach** — A team's representative. Coaches join a tournament by invitation, manage their roster, assign students to roles, and set witness call orders. See the [Coach Guide](/docs/coach/).

**Scorer (Judge)** — A person who scores a trial. Scorers use a unique emailed link and do not create an account. See the [Scorer Guide](/docs/scorer/).

**Presider** — The scorer in a pairing responsible for running the trial and, when configured, selecting the trial's tiebreaker winner. The first scorer added to a pairing becomes the presider automatically; an organizer can change it. A presider can be set to **tiebreaker only**, submitting a team selection instead of a scored ballot.

**Delegate (co-organizer)** — An organizer granted access to a tournament by the owner. Delegates use the organizer dashboard but cannot be the tournament owner. See [Managing Teams and Organizers](/docs/organizer/managing-teams-and-organizers/).

**Owner** — The organizer who owns a tournament. Only the owner can change tournament status or delete the tournament. Ownership of a team can be transferred to a joined coach from the team's organizer view.

## Tournament structure

**Tournament** — The top-level entity: a case format, scoring configuration, awards, rounds, courtrooms, teams, and scorers.

**Case format** — The case definition: prosecution/plaintiff and defense witnesses, swing witnesses, witnesses called per trial, and whether the case is criminal (which sets the **Prosecution** vs. **Plaintiff** label).

**Round** — A set of pairings in the tournament schedule. Pairings and results for a round can be published independently.

**Pairing (matchup)** — A single prosecution/plaintiff team versus defense team in a courtroom within a round.

**Courtroom** — A physical room or online meeting location assigned to a pairing. Assigning the same courtroom to two pairings in one round is flagged as **double-booked**.

**Team code** — A short identifier for a team, shown in pairings, scorer conflict checks, schedules, results, and standings. Defaults to the team name if left blank. Codes are intentionally used instead of school names on scorer screens.

**Field** — The set of participating teams and their codes and names. Coaches see this on the **Field** page.

## Witnesses and roles

**Swing witness** — A witness that may be called by either side. Swing witnesses count as available to both sides when MockScores validates the number of witnesses called per trial. Common in AMTA-style cases.

**Call order** — The ordered list of witnesses a team will call, one witness per numbered position. Selecting a witness in one position removes it from the others so no witness is called twice.

**Assignable field** — A scoring field that a coach can attach a specific student to. Fields such as sportsmanship or deductions are usually not assignable.

**Role** — The label shown on the ballot for a scored item, such as Opening Statement or Direct Examination.

## Scoring

**Scorecard** — The structured set of scoring categories and fields a scorer fills out for a pairing. The scorecard is the tournament-level configuration; a submitted scorecard for a specific pairing is a **ballot**.

**Ballot** — A single scorer's submitted scores for one pairing, including any student assignments and award nominations. One assignment accepts only one ballot.

**Combined scoresheet** — A view of all submitted ballots for a pairing together.

**Scoring category** — A group of scored fields, such as Witnesses, Opening, or Professionalism. The witness category is generated from the tournament's witness list and cannot be removed.

**Multiplier** — A factor applied to a field's entered score when totals are calculated. It cannot be zero; a negative multiplier can be used for deductions.

**Award category** — A type of individual nomination a scorer may submit after a ballot, such as Best Attorney, with minimum and maximum nominee counts.

**Nomination** — A scorer's selection of a student for an award category, optionally ranked when multiple students are chosen.

## Standings and tiebreakers

For how each statistic below is calculated, with worked examples, see [Mock Trial Scoring Metrics Explained](/docs/organizer/scoring-metrics/).

**Standings** — The ranked list of teams computed from submitted ballots using the tournament's standings configuration.

**Standings configuration** — The serialized rules (stored as a Lisp-like DSL) that define which statistics are calculated and how teams are ranked and ordered. Edited visually in Blockly or directly as DSL text. See [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/).

**Intermediate statistic** — A value calculated at the pairing level, used as a reusable building block (for example, whether a round was a win). Intermediates are not aggregated onto the team row and cannot be referenced directly by a `by` tiebreaker rule.

**Aggregated statistic** — A value calculated across the whole tournament (for example, total points or ballots won). Only aggregated statistics can be used as tiebreakers.

**Trimmed statistic** — A statistic that removes a set number of values from each end before aggregating, used to discard high and low outliers.

**Tiebreaker** — A rule that orders teams still tied after the preceding rules. Rules are applied in priority order; the first listed is compared first.

**Head-to-head (h2h)** — A tiebreaker that compares tied teams using only the pairings in which they faced each other.

**when-tied** — A tiebreaker rule that applies nested rules only to tie-groups of a given size range, for example resolving only two-way ties with head-to-head.

**Rank method** — The policy for assigning rank numbers to teams still tied after every rule, modeled on pandas rank methods: `average`, `min`, `max`, `first` (default), or `dense`.

**Presider selection** — The presider's recorded choice of which team should win a tied trial. It can be used as a statistic in standings when a tournament's rules call for it.

## Workflow actions

**Publish pairings** — Make a round's matchups visible to coaches so they can prepare roles and call orders. One-way action.

**Lock a round** — Open scorer ballots for data entry. Locking prevents further coach edits and copies a team's saved defaults into any pairing left unset. Permanent — a round cannot be unlocked.

**Publish results** — Release a round's scores and ballots to coaches. One-way action, separate from publishing pairings.

**Default assignments and default call order** — A team's saved starting roles and witness order. If a coach does not set pairing-specific preparation, locking the round copies these defaults into the pairing.

## Related reading

- [Getting Started](/docs/getting-started/) — accessing MockScores by role
- [Frequently Asked Questions](/docs/faq/) — common questions before and during a tournament
- [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/) — the standings DSL in depth
