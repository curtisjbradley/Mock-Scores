---
title: Managing Ballots and Results
description: Assign scorers and presiders, open scoring, monitor ballots, and release a round's results.
sidebar:
  order: 8
---

Ballot management happens inside an open round. Prepare all assignments before locking because a locked round cannot be reopened for coach changes.

## Assign scorers

On each pairing card, select **Add Scorer**.

- Search for and select a scorer from the tournament scorer pool to create an **Online** assignment.
- Type a name and select **Create offline scorer** to create a **Paper** assignment.

The first scorer added becomes the presider automatically. Use **Change presider** to select another assigned scorer.

### Presider options

The presider normally submits scores and, when configured, selects the trial's tiebreaker winner. Enable **Only Score Tiebreaker** when the presider should see the roster and submit only the tiebreaker selection rather than a scored ballot.

Review each scorer row for:

- **CONFLICT**, when the scorer's recorded conflict list includes either team.
- **CONFLICT REPORTED**, when the scorer reported a conflict from their ballot link.
- **BOUNCED**, when a scoring-link email could not be delivered.

Remove or replace an unsubmitted assignment when necessary. A submitted scorer cannot be removed from the pairing through this control.

## Lock the round

After pairings are published and coaches have finished preparing, select **Lock round** and confirm.

Locking:

- Opens scorer ballots for data entry.
- Prevents coaches from changing pairing-specific roles and witness call orders.
- Copies a team's saved default roles or call order into a pairing when the coach left that item unset.

:::danger
Locking is permanent. A round cannot be unlocked. Confirm the pairings and coach preparation before continuing.
:::

## Send online scoring links

After locking, select **Send scoring links**. The bulk action emails a unique link to every assigned online scorer and can be performed only once for the round.

After the bulk send, each unsubmitted online scorer row offers **Send Scoring Link** or **Resend link**. Use this when a scorer cannot find the first email or an address was corrected.

Paper scorers do not receive email links.

## Monitor ballot completion

Each pairing displays a submitted count such as `2/3 ballots`. A scorer row shows its result after submission and provides **View** for the individual scoresheet.

When at least one ballot has scores, select **Combined scoresheet** to review the pairing's ballots together.

The tournament **Overview** highlights paper ballots still awaiting input and pairings that lack courtrooms, scorers, or presiders.

## Enter paper or replacement scores

For a paper scorer, select **Input scores** to open that assignment's score form and transcribe the ballot.

For an unsubmitted online scorer, select **Manually enter** when an organizer must enter the scorer's ballot. MockScores warns that submitting the form invalidates the scorer's original link, so use this only when the organizer is taking over the assignment.

Submitted ballots are final from the scoring form. Review the paper ballot or scorer's values before confirming submission.

## Handle a scorer-reported conflict

When **CONFLICT REPORTED** appears:

1. Confirm that the scorer should not continue.
2. Add a replacement scorer to the pairing.
3. Check that the replacement has no recorded conflict.
4. Send the replacement's scoring link after the round is locked.

The original scorer's link displays the reported-conflict message and should not be reused. The scorer will receive a new email with their new assignment and should use that to score.

## Publish round results

**Publish results** appears only when:

- The round has at least one pairing.
- At least one scorer is assigned.
- Every expected ballot has been submitted.

Review the individual and combined scoresheets, standings, and award nominations first. Then select **Publish results** to make the round available to coaches in **Results**.

:::caution
Result publication is one-way. Published results cannot be returned to a private state from the organizer interface.
:::

Publishing results is separate from publishing pairings. Pairings let coaches prepare before the round; results let them see scores and ballots after the round.

## Troubleshooting

### The scoring-link button is missing

The round must be locked. The bulk-send button also disappears after links have been sent once; use the per-scorer send or resend control instead.

### A scorer sees “Scoring Not Open Yet”

The round has not been locked. If the round should be open, confirm that you locked the correct round and ask the scorer to refresh.

### Publish results does not appear

At least one expected ballot is still missing, or the round has no scored assignments. Review the ballot counters and enter any paper ballots.

### A scorer's link says it is no longer valid

A ballot has already been submitted with that assignment link, or an organizer submitted it manually. Review the scorer row and scoresheet rather than requesting another submission on the same assignment.

