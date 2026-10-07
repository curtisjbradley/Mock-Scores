---
title: Tournament-Day Runbook
description: A timeline for organizers running a MockScores tournament — from the week before through the final round and results.
sidebar:
  order: 9
---

This runbook is a condensed, time-ordered checklist for running a tournament day. It assumes the tournament is already set up. For setup instructions, start with the [Organizer Guide](/docs/organizer/). Keep this page open on competition day.

:::caution
Publishing pairings, locking a round, and publishing results are one-way actions. Verify each one before you use it.
:::

## The week before

- Confirm the [case, witnesses, scorecard, awards, and roster fields](/docs/organizer/configuring-tournament-structure/) are final. Changing them after coaches prepare makes the tournament harder to audit.
- Confirm the [standings and tiebreaker configuration](/docs/organizer/managing-tiebreakers/) matches the official rules, and preview a tie at each level.
- Confirm every team has [joined and built its roster](/docs/organizer/managing-teams-and-organizers/). Follow up on pending invitations.
- Build the [scorer pool and record conflicts](/docs/organizer/managing-scorers-and-courtrooms/). Fix any **BOUNCED** email addresses.
- Add every [courtroom](/docs/organizer/managing-scorers-and-courtrooms/), including online meeting locations for remote trials.
- Add any co-organizers who will help run the day.

## The day before

- [Create the rounds](/docs/organizer/creating-rounds-and-pairings/) and build pairings for at least the first round.
- Check each pairing: two different teams, a courtroom that is not double-booked, and no team appearing twice in the round.
- Publish the first round's pairings so coaches can prepare roles and call orders.
- Spot-check a few teams' [organizer views](/docs/organizer/managing-teams-and-organizers/) to confirm rosters and default assignments exist.
- Confirm each pairing has the expected number of scorer positions and a presider.

## Morning of — before the first round

Use the organizer **Overview** as your pre-round checklist, then confirm each pairing directly. Before locking the round, verify:

- Every pairing has two different teams.
- No team appears in more than one pairing in the round.
- Every pairing has a courtroom, and no courtroom is double-booked.
- Each pairing has the expected number of scorers.
- Every pairing has a presider.
- No scorer is assigned to a team on their conflict list.
- Coaches have completed role assignments and call orders, or their saved defaults are ready to be copied.

## Opening a round

1. [Lock the round](/docs/organizer/managing-ballots-and-results/). This opens ballots and copies team defaults into any pairing left unset. It cannot be undone.
2. Select **Send scoring links** to email every assigned online scorer. This bulk action runs once per round.
3. For any scorer who cannot find the email or whose address was corrected, use the per-scorer **Send** or **Resend** control.
4. Paper scorers do not receive links — hand them a printed ballot. See [Paper and Offline Ballots](/docs/scorer/paper-ballots/).

## While a round is scored

- Watch each pairing's ballot counter, such as `2/3 ballots`.
- Enter [paper or replacement scores](/docs/organizer/managing-ballots-and-results/) as judges hand them in.
- Handle any **Conflict Reported**: assign a replacement with no conflict and send their link.
- Use **Combined scoresheet** to review a pairing's ballots once scores arrive.

## Between rounds

- Build and publish the next round's pairings (if not already done) so coaches can prepare.
- Confirm scorer and presider assignments for the next round.
- Resolve any outstanding missing ballots from the previous round before publishing its results.
- Optionally review interim [standings](/docs/organizer/standings-and-awards/) for the completed rounds.

## Releasing results

**Publish results** appears for a round only when it has at least one pairing, at least one scorer assigned, and every expected ballot submitted.

Before publishing:

1. Confirm every expected ballot was submitted.
2. Review individual and combined scoresheets for anomalies.
3. [Check standings and award nominations](/docs/organizer/standings-and-awards/) for the rounds the rules include.
4. Publish results to release scores and ballots to coaches.

## After the final round

- Select the exact rounds the tournament rules include for final standings.
- Verify column labels and sort direction against the official rules.
- Review any presider tiebreaker values used by the configuration.
- Have a second organizer independently check the leading teams and any tied positions.
- Export standings, raw results, award nominations, and rosters for your records. See [Reviewing Standings and Awards](/docs/organizer/standings-and-awards/).
- Once the event is finished, **Mark completed** or **Archive** the tournament rather than deleting it.

:::tip
If you change the tiebreaker configuration after ballots exist, the standings recalculate — including from already-submitted ballots. Recheck and re-export after any configuration change.
:::

## Quick troubleshooting

**A scorer sees "Scoring Not Open Yet."** The round is not locked, or they are looking at the wrong round. Lock the correct round and ask them to refresh.

**The scoring-link button is missing.** The round must be locked, and the bulk-send runs only once — use the per-scorer send or resend after that.

**Publish results does not appear.** A ballot is still missing or no scored assignment exists. Check the counters and enter any paper ballots.

**A scorer's link says it is no longer valid.** A ballot was already submitted for that assignment, or an organizer entered it manually. Review the scoresheet instead of requesting another submission.
