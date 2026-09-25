---
title: Configuring Tournament Structure
description: Manage the scorecard, witnesses, awards, and custom roster fields after tournament creation.
sidebar:
  order: 4
---

The **Structure** section holds settings that shape coach assignments, scorer ballots, award nominations, and standings. Changes apply to the tournament, so review them before rounds are locked.

## Manage the scorecard

Open **Structure** and select **Manage Scorecard**.

The scorecard is organized into categories and fields. Drag categories to reorder them, use **Add category** to create a section, and add or remove fields within each category.

Each field includes:

| Setting | Effect |
|---|---|
| **Role** | Label shown to coaches and scorers. |
| **Min** and **Max** | Range accepted by the ballot. |
| **Multiplier** | Multiplies the entered score; it cannot be zero. Negative values can be used for deductions. |
| **Assignable** | Lets coaches attach a student to the role. |
| **Award** | Makes students assigned to the field eligible for that award category. |
| **Visible** | Determines whether the scorer enters a value for the field. |

Regular fields must apply to the prosecution/plaintiff side, defense side, or both. Witness fields must apply to **Calling**, **Crossing**, or both.

The page calculates the maximum score available to each side. An unequal maximum produces a warning; verify that any difference is intentional.

:::caution
Changing a scorecard after coaches have created assignments or scorers have submitted ballots can make the tournament harder to audit. Finalize the scorecard before publishing the first pairings whenever possible.
:::

## Manage witnesses

Open **Structure** and select **Manage Witnesses**.

1. Set how many witnesses each side calls in a trial.
2. Add every prosecution/plaintiff and defense witness.
3. Enable **Case has swing witnesses** if a character can be called by either side, then add the swing witnesses.
4. Select **Save**.

Witness names cannot be empty. A side's **witnesses called** value cannot be negative or exceed the witnesses available to that side, including swing witnesses.

Coaches use these names when they set a call order and assign students. Enter the character names exactly as they should appear on the ballot.

## Manage individual award categories

Open **Structure** and select **Manage Awards**.

For each category, configure:

- **Category Name**
- **Min Nominees**, which may be zero
- **Max Nominees**, which must be at least one

The minimum cannot exceed the maximum. After creating a category, return to **Manage Scorecard** and link the appropriate assignable fields to that award.

Removing an award category unlinks any scoring fields that used it. It does not automatically replace those links with another category.

## Manage custom roster fields

Open **Structure** and select **Custom Roster Fields**. Custom fields add organizer-defined columns to every coach's roster.

Available field types are:

- **Text**, for values such as grade level or T-shirt size.
- **Number**, for numeric values such as year in competition.

Coaches edit these values directly in the roster table. Removing a custom field also removes the values coaches entered for it.

## Manage standings rules

Open **Structure** and select **Manage Tiebreakers** to choose which statistics appear in standings and how tied teams are ordered. See [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/) for the visual editor, DSL grammar, and validation guidance.

## Final structure review

Before teams begin preparing for a round, confirm that:

- The case type uses the correct prosecution or plaintiff label.
- Every witness is listed on the correct side.
- The number of witnesses called matches the competition rules.
- Score ranges and multipliers match the official ballot.
- Assignable fields cover every role coaches must fill.
- Award eligibility and nomination limits are correct.
- The standings configuration produces the intended order.

