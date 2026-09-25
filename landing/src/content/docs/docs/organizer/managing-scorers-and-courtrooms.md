---
title: Managing Scorers and Courtrooms
description: Build the scorer pool, record conflicts, and add the locations used by pairings.
sidebar:
  order: 6
---

Scorers and courtrooms are tournament-level resources. Add them before building pairings so they are available from each round.

## Add an online scorer

1. Open the tournament and select **Scorers**.
2. Select **Add scorer**.
3. Enter the scorer's first name, last name, and valid email address.
4. Select **Add scorer**.

Online scorers do not need MockScores accounts. Their email address is used to deliver the unique link for each assigned ballot.

Use **Edit** to correct a scorer's name or email. A **BOUNCED** badge means an email delivery attempt failed; correct the address before sending or resending a scoring link.

## Import scorers from CSV

Select **Import CSV** to upload a file or paste text with these columns:

```csv
first_name,last_name,email
Jane,Smith,jane.smith@example.com
```

Review the preview, select **Import**, and correct any row-level errors shown in the result.

## Record scorer conflicts

1. Find the scorer and select **Manage Conflicts**.
2. Choose each team the scorer must not evaluate.
3. Remove a listed conflict only when it no longer applies.
4. Select **Done**.

MockScores flags an assigned scorer when either team in the pairing is on their conflict list. The organizer **Overview** also reports scorers assigned to conflicts.

:::caution
Conflict flags are warnings, not an automatic reassignment system. Review and correct every flagged assignment before opening scoring.
:::

Scorers can also report an unexpected conflict when they open an online ballot. The pairing then displays **CONFLICT REPORTED**, and the scorer's link no longer opens a scorecard. Assign a replacement scorer and send the replacement's link.

## Remove a scorer

Select **Remove** from the **Scorers** page to remove a person from the tournament's scorer pool. If the scorer is already assigned to a pairing, review that round and replace the assignment as needed.

## Add a courtroom

1. Select **Courtrooms**.
2. Select **Add courtroom**.
3. Enter a required **Name**, such as `1A`.
4. Optionally enter **Details**, such as `2nd Floor` or an online meeting location.
5. Select **Add courtroom**.

Courtroom details appear alongside the room name when organizers assign pairings. Use **Edit** to update either value or **Remove** to remove the courtroom from the available list.

## Avoid double-booking

When the same courtroom is assigned to more than one pairing in a round, each affected pairing displays **Double-booked**. Change one of the courtroom assignments before the round begins.

Courtrooms can initially be left as **TBD**, but the organizer **Overview** counts pairings without a courtroom so they can be resolved before the round.

