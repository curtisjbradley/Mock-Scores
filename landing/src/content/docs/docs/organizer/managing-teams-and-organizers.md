---
title: Managing Teams and Organizers
description: Invite teams and co-organizers, update invitations, and review team preparation.
sidebar:
  order: 5
---

Add teams early enough for coaches to create accounts, build rosters, and prepare their default assignments. Add co-organizers when other tournament staff need access to the organizer dashboard.

## Add a team

1. Open the tournament and select **Teams**.
2. Select **Add team**.
3. Enter the **Team name** and **Coach email**.
4. Optionally enter a **Team code**. If left blank, it defaults to the team name.
5. Select **Send invite**.

Team names must be unique within the tournament. The coach receives an invitation and must use that same email address when accessing the team.

The team's status remains **pending** until the invited coach joins. A joined team appears as **accepted**.

:::note
Team codes appear in pairings, scorer conflict checks, schedules, results, and standings. Use short, distinct codes that do not reveal more information to scorers than your tournament rules permit.
:::

## Import teams from CSV

Select **Import CSV** to upload a file or paste CSV text. The expected columns are:

```csv
name,coach_email,code
Eagles,coach@school.edu,EGL
```

The `code` column is optional. Review the preview before importing. After the import, MockScores reports how many records were created and identifies row-level errors.

## Edit or remove a team

From **Teams**, you can:

- Select **Edit** to update the team name or code.
- Select **Edit email** while an invitation is still pending.
- Select **Remove** to remove the team from the tournament.

The coach email cannot be edited from this table after the invitation has been accepted.

:::caution
Removing a team can affect rosters, assignments, and pairings. Review the team's use in current rounds before confirming removal.
:::

## Open a team's organizer view

Select a team name to open its team dashboard as an organizer. This view uses the same sections coaches use: **Overview**, **Schedule**, **Results**, **Coaches**, **Roster**, **Field**, and **Standings**.

Use it to check whether a team has:

- Added its students and custom roster information
- Set default role assignments and witness call orders
- Prepared pairing-specific assignments for published rounds
- Added the appropriate coaches

Organizers can also transfer team ownership to a joined coach from the team's **Coaches** page.

## Export all rosters

Select **Export All Rosters** on the **Teams** page to download `rosters.csv`. This export is useful for eligibility checks and tournament-day registration.

## Add a co-organizer

1. Select **Organizers**.
2. Select **Add Organizer**.
3. Enter the organizer's name and email address.
4. Select **Add organizer**.

New organizers are added as delegates. Pending invitations show an email status. You may edit a delegate's email before they join or remove the delegate.

The tournament owner cannot be removed, and an organizer cannot remove their own access from this page.

## Invitation troubleshooting

### A coach or organizer did not receive an invitation

Confirm the email address and check its delivery badge for a bounce. Ask the recipient to check spam or junk mail. If the invitation is still pending, correct the email address if necessary.

### A coach created an account but cannot see the team

The account email must exactly match the team's invited coach email. Correct the pending invitation or ask the coach to use the matching account.

### A team is missing from a round

Adding a team does not automatically create a pairing. Open the round and add a pairing that includes the team.

