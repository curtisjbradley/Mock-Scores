---
title: Creating a Tournament
description: Creating a tournament in MockScores is easy and only requires a few clicks.
---

The first step in preparing for your competition is creating a tournament in MockScores. The tournament creation wizard collects the case, scoring, awards, and standings settings that MockScores will use throughout the competition.

## Before you begin

You must be logged in to MockScores as an organizer. Open the [organizer dashboard](https://app.mockscores.org/organizer), then select **New Tournament** at the top of the page.

The wizard contains up to six steps:

1. Details
2. Witnesses
3. Scoring template
4. Award categories
5. Scoring categories
6. Tiebreakers

:::note
If you select a preset scoring template, MockScores skips the **Award categories** and **Scoring categories** steps because those settings are included in the template. Select **Manual** if you want to complete all six steps.
:::

You can use the **Back** button to review an earlier step before creating the tournament.

## Step 1: Tournament details

The first page asks for the basic information used to identify and schedule the tournament.

- **Tournament name** is the name displayed to organizers, coaches, and scorers. This field is required.
- **Location** is the venue or general location of the tournament. This field is required.
- **Start date** is the first day of the tournament. This can be marked as TBD.
- **End date** is the last day of the tournament. This can be marked as TBD.
- **Share individual rankings** — Allows coaches to see award nominations recorded on ballots. Leave this disabled if those nominations should remain hidden from coaches.

:::note
All of these values can be edited at a later time. Adding a Start and End date has no effect on the tournament. It only serves as information for the coaches.
:::

Select **Next** after completing the required fields.

## Step 2: Case format and witnesses

This step defines the case structure used when teams create rosters and assign students to roles.

### Case information

- **Case name** - Enter the full name of the competition case. This field is required.
- **Criminal case** - This determines if MockScores should use the label **Plaintiff** or **Prosecution**.

### Witness lists

Add every witness that may be called by each side:

- **Prosecution/Plaintiff witnesses**
- **Defense witnesses**
- **Swing witnesses**, when applicable.

Use the add and remove controls to make each list match the case materials. Every row that remains in a witness list must contain a name.

For each side, enter the number of **Witnesses called per trial**. This number:

- Is required
- Must be zero or greater
- Cannot exceed the number of witnesses available to that side

### Swing witnesses

Enable **Case has swing witnesses** when the case includes witnesses who may be called by either side. After enabling it, add the swing witness names to the list.

Swing witnesses count as available to both sides when MockScores validates the number of witnesses called per trial. This option is commonly used for AMTA-style cases.

Select **Next** when the case format is complete.

:::caution
Enter witness names as they should appear throughout the tournament. Coaches will use these names when assigning students to witness roles.
:::

## Step 3: Choose a scoring template

The scoring template controls the structure of the ballot. Choose one of the available presets or select **Manual**.

### Preset template

A preset includes its scoring categories, scoring fields, and award categories. Selecting a preset moves you directly to **Tiebreakers & standings** after this step.

Choose a preset when its ballot structure matches your tournament rules. You can review and update the tournament's configuration from the tournament dashboard after creation.

You can also start with a template then modify it after you finish tournament setup.

### Manual setup

Select **Manual** to define the award categories and scoring categories yourself. This route continues through steps 4 and 5.

Select **Next** after choosing an option.

## Step 4: Award categories

This step appears only when you choose **Manual**. Award categories determine the types of individual nominations a scorer may submit after completing a ballot, such as **Best Attorney** or **Best Witness**.

Award categories are optional. If your tournament does not collect individual nominations, leave this page empty and select **Next**.

For each category, enter:

- **Category name** - The award shown to scorers and organizers.
- **Min nominees** - The minimum number of nominations a scorer may make. This value may be zero.
- **Max nominees** - The maximum number of nominations a scorer may make. This value must be at least one.

The minimum cannot be greater than the maximum. Use **Add award category** to create another category or **Remove Category** to delete one.

Award categories created here become available in the next step when assigning your awards to different scoring fields.

If a round does not have enough participants in a category to meet the minimum number of nominations, the scorer will have to nominate all the students.

## Step 5: Scoring categories

This step appears only when you choose **Manual**. It defines every category and field that appears on a ballot.

MockScores begins with a witness category. You can add additional categories, such as opening statements, closing arguments, professionalism, or deductions. Drag categories to change the order in which they appear.

The witness category cannot be renamed or removed because MockScores uses it to generate scoring rows for the witnesses defined in step 2.

### Configure a scoring field

Each scoring field contains the following settings:

| Setting        | Purpose                                                                                                                            |
|----------------|------------------------------------------------------------------------------------------------------------------------------------|
| **Role**       | The label displayed on the ballot, such as Opening Statement or Direct Examination.                                                |
| **Min**        | The lowest score a scorer may enter.                                                                                               |
| **Max**        | The highest score a scorer may enter.                                                                                              |
| **Multiplier** | Multiplies the entered score when totals are calculated. It cannot be zero.                                                        |
| **Assignable** | Allows coaches to assign a student to the field. Disable this for fields such as sportsmanship or deductions.                      |
| **Award**      | Links the field to an individual award category. Select **None** when the field is not eligible for an award.                      |
| **Visible**    | Determines whether scorers enter the field. A nonvisible field may be used by organizers for adjustments such as point deductions. |

For a regular category, select **P**, **D**, or both to determine which side receives the scoring field.

For the witness category, select **Calling**, **Crossing**, or both:

- **Calling** assigns the field to the side that called the witness.
- **Crossing** assigns the field to the opposing side conducting cross-examination.

Use **Add field** to add another row to a category and **Add category** to create another category.

### Validation and maximum scores

Before continuing, MockScores checks that:

- Every minimum is less than or equal to its maximum.
- No multiplier is zero.
- Every regular field applies to at least one side.
- Every witness field applies to calling, crossing, or both.

The bottom of the page displays the maximum possible score for each side. If the prosecution/plaintiff and defense maximums are different, MockScores displays a warning. You can continue, but you should confirm that the unequal totals are intentional before the tournament begins.

Generally, a tournament should not allow a team to earn more points than the other by providing unequal scoring opportunities.

Select **Next** when the ballot is configured correctly.

## Step 6: Tiebreakers and standings

The final step determines how team standings will be calculated and sorted.

Choose one of the available standings templates. Each option includes a description of the ranking method it applies.

Select **None / Manual** if you do not want to choose a template yet. You can build a custom standings configuration from the tournament dashboard after the tournament is created.

:::tip
If your tournament uses custom ranking rules, you can create the tournament with **None / Manual** and configure the rules later. See [Managing Tiebreakers](../managing-tiebreakers/) for information about the visual Blockly editor and advanced DSL.
:::

Select **Create tournament** to finish. MockScores creates the tournament and opens its organizer dashboard.

## After creating the tournament

Use the tournament dashboard to continue preparing the competition. Common next steps include:

1. Add participating teams and coaches.
2. Add courtrooms.
3. Add or invite scorers.
4. Create the tournament rounds.
5. Review the scoring and standings configurations.
6. Create pairings and assign scorers when each round is ready.

Tournament details, case settings, witnesses, scoring fields, awards, and standings rules can be managed from the tournament dashboard after creation.

## Troubleshooting

### I cannot continue from Tournament Details

Make sure the tournament name and location are not blank. Enter both dates or mark the unfinished dates as to be determined. If both dates are known, confirm that the end date is not before the start date.

### The witness count is rejected

The number of witnesses called per trial cannot exceed the number available to that side. Add any missing witness names, enable swing witnesses when appropriate, or lower the witnesses-called value.

### I do not see Award Categories or Scoring Categories

You selected a preset scoring template. Presets already contain those settings, so the wizard skips both manual configuration steps. Return to **Scoring template** and select **Manual** if you want to define them yourself.

### A scoring field is marked invalid

Confirm that its minimum is not greater than its maximum, its multiplier is not zero, and it applies to at least one side. Witness fields must apply to **Calling**, **Crossing**, or both.

### The maximum scores are unequal

Review the sides selected for each regular field and the calling/crossing settings for each witness field. Also check field multipliers and the number of witnesses called per trial. Unequal maximums are allowed, but they should match the tournament's intended scoring rules.

### I am not ready to configure standings

Select **None / Manual** on the final step. The tournament can be created without a standings template, and its tiebreakers can be configured later from the tournament dashboard.