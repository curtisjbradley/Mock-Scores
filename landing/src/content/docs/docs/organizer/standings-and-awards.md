---
title: Reviewing Standings and Awards
description: Filter standings, verify award nominations, and export tournament results.
sidebar:
  order: 10
---

Open the tournament and select **Standings** to calculate rankings from submitted ballots and review individual award nominations.

## Filter by round

Use the round checkboxes to include or exclude rounds from the calculation. **All** selects every round and shows a partial state when only some rounds are selected.

The standings update from the ballots in the selected rounds. If none are selected, MockScores asks you to select at least one round.

This filter also controls which individual award nominations appear below the standings.

## Read the standings

The table shows:

- Current rank
- Team code
- Team name
- Each column defined by the tournament's tiebreaker configuration

Decimal values are displayed to three places. If the table reports that no ballots have been submitted, confirm that the selected rounds contain completed ballots.

If the page reports **No standings configuration set**, open **Structure → Manage Tiebreakers** and create or select a configuration. See [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/).

The visual rule summary below the table helps confirm which statistics and tiebreakers produced the order.

## Export data

When ballot data is available, the page offers:

- **Download Standings CSV**, which exports the current calculated order and displayed columns for the selected rounds.
- **Download Results CSV**, which exports raw ballot results.
- **Export Awards CSV**, which exports the award nominations currently included by the round filter.

The roster export is separate. Open **Teams** and select **Export All Rosters** to download `rosters.csv`.

## Review award nominations

Nominations are grouped by award category and list:

- Round and category
- Student name and team
- Side
- Rank within the scorer's nominations
- Scorer
- A link to the source ballot

Select **View** to inspect the ballot supporting a nomination. Use this review to identify missing or unexpected nominations before producing award results outside MockScores.

Whether coaches can see nominations on their released ballots is controlled by **Structure → Tournament Details → Share individual rankings**.

## Verification before publication

Before publishing the final round or announcing standings:

1. Select the exact rounds included by the tournament rules.
2. Confirm that every expected ballot was submitted.
3. Verify the column labels and sort direction against the official rules.
4. Review any presider tiebreaker values used by the configuration.
5. Export standings and raw results for your records.
6. Have a second organizer independently check the leading teams and any tied positions.

:::caution
Changing the tiebreaker configuration changes the calculated standings, including calculations based on already submitted ballots. Recheck and re-export results after every configuration change.
:::

## Troubleshooting

### A team is missing or has no values

Confirm that the team participated in a pairing and that ballots were submitted for a selected round.

### The order does not match the tournament rules

Open **Manage Tiebreakers** and check the order, ascending or descending direction, and referenced statistics. Use preview data that forces a tie at each level.

### Award nominations are missing

Confirm that award categories existed, the scorecard fields were linked to those categories, and the scorer selected the required nominees before submitting. Also confirm that the nomination's round is selected in the standings filter.

