---
title: Managing Tiebreakers
description: MockScores allows for custom tiebreakers through use of a DSL. These tiebreakers can be programmed visually through Blockly or through a Lisp-like language.
---

MockScores lets organizers control how teams are ranked when results are published. You can start with a template or build a custom ranking system using either the visual Blockly editor or through a text based editor.

Both editors allow for the same levels of configuration. The visual editor is recommended for most organizers, while the text editor is useful for managing complex rules and copying over configurations.

## Open the tiebreaker editor

1. Open your tournament from the organizer dashboard.
2. Select **Structure**
3. Select **Manage Tiebreakers**.

The editor is divided into three parts:

- **Dummy Data Preview** shows a preview of what the standings would look like if applied on dummy data. The preview will update automatically as the configuration is changed.
- **Statistics** define the values MockScores calculates for each team.
- **Tiebreaker order** determines which statistics are compared first.

## How rankings are calculated

MockScores compares teams using the statistics in your tiebreaker order.

There are 2 types of statistics that are calculated.

- **Intermediate Statistics** are calculated at the pairing level. This is useful for determining if a round was a *win* for one side.
- **Aggregated Statistics** are calculated across the whole tournament. These statistics could be things like the total number of points a team has scored or a team's Competitive Strength.

Tiebreakers are only valid on Aggregated Statistics.

MockScores will look at the defined tiebreakers. It will then sort the teams based on the first tiebreaker. It will go through all the tiebreakers until there are none remaining. Teams will be sorted at the end by their team code.

For example, a tournament might rank teams by:

1. Ballots won
2. Total points
3. Presider selections
4. Point differential

In this configuration, total points are only considered when two teams have the same number of ballots won. Presider selections are only considered when both ballots won and total points are tied.

:::note
The order of your tiebreakers matters. Place the tournament's most important ranking rule first.
:::

## Use a template

Templates provide a ready-to-use configuration for common tournament rules.

1. Select the template that most closely matches your tournament's rules.
2. Review the statistics and their order.
3. Use the preview to confirm that the results are ranked as expected.
4. Save the configuration.

You can customize a template after selecting it. This is often easier than starting from an empty configuration.

## Build tiebreakers with Blockly

Blockly is a block based programming tool similar to MIT's Scratch. 

MockScores allows organizers to define tiebreakers through Blockly, allowing for an easy-to-use and interactive experience.  
Blockly lets you create a configuration by connecting visual blocks. 
Blocks only connect where their values are compatible, which helps prevent invalid rules.

### Define a statistic

Create one statistic for each value that should appear in the standings or be used to rank teams.

1. Add a statistic block.
2. Give the statistic a clear name, such as **Ballots Won** or **Point Differential**.
3. Connect the blocks that calculate its value.

Statistics can use information recorded for each pairing, including:

- Points earned by the team
- Points earned by the opposing team
- The number of scorers assigned to the pairing
- Whether the team received the presider's tiebreaker selection

Depending on your tournament's rules, you can total values across rounds, calculate averages or percentages, compare values, and combine multiple calculations.

### Set the tiebreaker order

After defining your statistics, add them to the tiebreaker list in priority order. The statistic at the top is compared first.

Use clear display labels because these names also help organizers and coaches understand the published standings.

:::tip
Only add rules that are part of your tournament's published procedures. A shorter, clearly ordered list is easier to verify and explain.
:::

## Use the DSL editor

The DSL editor provides direct access to the same configuration created by Blockly. It uses a Lisp-like syntax, where each expression is enclosed in parentheses and begins with an operation.

Use the DSL editor when you need precise control, want to review the generated configuration, or are comfortable editing structured text.

Keep these rules in mind:

- Parentheses must remain balanced.
- Give each statistic a unique name.
- Define every statistic referenced by a column or tiebreaker.
- The order of the ranking rules determines their priority.
- Display labels should be understandable to people viewing the standings.

Changes made in either editor affect the same configuration. After editing the DSL, return to the visual view to confirm that the rules still appear as intended.

:::caution
Do not paste a configuration from another tournament without reviewing it. The other tournament may use different scoring rules, numbers of scorers, or ranking priorities.
:::

## DSL grammar reference

This section documents the serialized DSL for advanced users. The DSL is the source of truth stored by MockScores. Blockly translates between visual blocks and this format, while standings calculations interpret the DSL directly.

:::note
For most users, this information may be highly technical. The visual editor will allow you to do everything you can do through the DSL. You can however attach this information into a LLM and have it help you define a configuration.
:::

### Lexical rules

- Whitespace between tokens is ignored.
- Parentheses delimit S-expressions.
- Keywords, field names, aggregation names, and sort directions are bare atoms.
- Statistic names and labels should be quoted strings so they can contain spaces.
- Numbers are bare numeric atoms, such as `0`, `3`, `-1`, or `2.5`.
- String literals cannot be used as numeric expressions.
- Names produced by the serializer escape embedded quotation marks and backslashes.

Although the parser accepts a bare atom wherever it expects a name, quoted names are recommended for consistent round-tripping.

### Formal grammar

The notation below uses `*` for zero or more repetitions, `|` for alternatives, and brackets for an optional value.

```text
config         ::= "(" "config" config-entry* ")"

config-entry   ::= stat-def
                 | team-stat-def
                 | intermediate-def
                 | trimmed-def
                 | columns-def
                 | tiebreakers-def

stat-def       ::= "(" "stat" name aggregation expression ")"
team-stat-def  ::= "(" "team-stat" name expression ")"
intermediate-def
               ::= "(" "intermediate" name aggregation expression ")"
trimmed-def    ::= "(" "trimmed" name aggregation number expression ")"

columns-def    ::= "(" "columns" column-def* ")"
column-def     ::= "(" "column" name [name] ")"

tiebreakers-def
               ::= "(" "tiebreakers" tiebreaker-def* ")"
tiebreaker-def ::= "(" "by" name order ")"
                 | "(" "h2h" name order ")"

aggregation    ::= "sum" | "avg" | "max" | "min" | "count"
order          ::= "asc" | "desc"
name           ::= quoted-string | bare-atom

expression     ::= number
                 | "(" "pairing" bare-atom ")"
                 | "(" "ballot" bare-atom ")"
                 | "(" "team" bare-atom ")"
                 | "(" "stat" name ")"
                 | "(" "intermediate" name ")"
                 | "(" "opponent" name ")"
                 | "(" binary-op expression expression ")"
                 | "(" "if" expression expression expression ")"
                 | "(" unary-op expression ")"

binary-op      ::= "+" | "-" | "*" | "/" | "**"
                 | "=" | "!=" | "<" | "<=" | ">" | ">="
                 | "and" | "or"

unary-op       ::= "sqrt" | "abs" | "neg" | "ln"
                 | "log10" | "exp" | "pow10"
```

An empty or whitespace-only document is treated as an empty configuration. Any nonempty document must have `(config ...)` as its root form.

### Configuration forms

| Form                             | Evaluation                                                                          | Purpose                                            |
|----------------------------------|-------------------------------------------------------------------------------------|----------------------------------------------------|
| `(stat "Name" AGG EXPR)`         | Evaluates `EXPR` for each pairing, then applies `AGG`                               | Defines a regular team statistic                   |
| `(team-stat "Name" EXPR)`        | Evaluates once using the team's calculated statistics                               | Defines a statistic derived from team-level values |
| `(intermediate "Name" AGG EXPR)` | Evaluates per pairing and aggregates, but is intended for reuse rather than display | Stores a reusable intermediate calculation         |
| `(trimmed "Name" AGG TRIM EXPR)` | Removes `TRIM` values from each end before aggregation                              | Defines a trimmed statistic                        |
| `(columns ...)`                  | Does not affect calculation                                                         | Selects and labels statistics shown in standings   |
| `(tiebreakers ...)`              | Evaluated from first to last                                                        | Defines the ranking sequence                       |

`TRIM` is parsed as a number. Use a nonnegative integer so the number of values removed from each end is unambiguous.

### Aggregations

| Aggregation | Result                        |
|-------------|-------------------------------|
| `sum`       | Adds the per-pairing values   |
| `avg`       | Returns their arithmetic mean |
| `max`       | Returns the greatest value    |
| `min`       | Returns the least value       |
| `count`     | Counts the evaluated entries  |

A `team-stat` does not include an aggregation token. Internally, it is marked as team-level and stored with `sum` as its aggregation value, but its expression is evaluated once against the team's statistics.

### Value and reference expressions

| Expression              | Meaning                                                   |
|-------------------------|-----------------------------------------------------------|
| `(pairing FIELD)`       | Reads `FIELD` from the current pairing value              |
| `(ballot FIELD)`        | Alias of `(pairing FIELD)` in the current implementation  |
| `(team FIELD)`          | Reads a built-in value from the current team's statistics |
| `(stat "Name")`         | Reads a previously calculated statistic                   |
| `(intermediate "Name")` | Reads an intermediate calculation                         |
| `(opponent "Name")`     | Reads a named statistic for the opposing team             |

`FIELD` is not restricted by the DSL parser. It is emitted as a property lookup on the current standings value. Use only fields exposed by the current MockScores standings model or generated by Blockly; an unknown field produces an undefined runtime value rather than a DSL syntax error.

References create dependencies between calculations. Define foundational per-pairing statistics and intermediates before team-level formulas that consume them. Cyclic references cannot produce a valid calculation.

### Operators

Arithmetic operators use prefix notation:

```lisp
(+ 4 2)
(- (pairing pointsFor) (pairing pointsAgainst))
(* (stat "Ballots Won") 2)
(/ (stat "Total Points") (team rounds_played))
(** (stat "Win Rate") 2)
```

The supported arithmetic operators are `+`, `-`, `*`, `/`, and `**`. Each accepts exactly two operands. Use `(neg EXPR)` for explicit unary negation.

Comparison and logical expressions return the number `1` when true and `0` when false:

```lisp
(> (pairing pointsFor) (pairing pointsAgainst))
(and (> (stat "Ballots Won") 0) (> (stat "Point Differential") 0))
(if (= (pairing won_presider_tiebreaker) 1) 1 0)
```

The supported comparisons are `=`, `!=`, `<`, `<=`, `>`, and `>=`. Logical expressions support `and` and `or`. The conditional form is `(if TEST THEN ELSE)`.

Math functions accept one expression:

| Form        | Calculation                  |
|-------------|------------------------------|
| `(sqrt x)`  | Square root                  |
| `(abs x)`   | Absolute value               |
| `(neg x)`   | Negation                     |
| `(ln x)`    | Natural logarithm            |
| `(log10 x)` | Base-10 logarithm            |
| `(exp x)`   | Euler's number raised to `x` |
| `(pow10 x)` | 10 raised to `x`             |

Calculations use JavaScript number semantics. Operations such as division by zero or a logarithm outside its domain can produce `Infinity` or `NaN`, which may lead to unexpected standings.

### Columns

Columns control presentation separately from calculation:

```lisp
(columns
  (column "Ballots Won" "Ballots")
  (column "Total Points" "Points")
  (column "Point Differential" "PD"))
```

The first name identifies the statistic. The second name is the displayed column label. If the label is omitted, the statistic name is used. A statistic can participate in ranking without being displayed, and a displayed statistic will not become a tiebreaker unless defined in the tiebreaker order.

### Tiebreaker rules

```lisp
(tiebreakers
  (by "Ballots Won" desc)
  (h2h "Ballots Won" desc)
  (by "Point Differential" desc)
  (by "Points Allowed" asc))
```

- `(by "Stat" desc)` ranks the greater value first.
- `(by "Stat" asc)` ranks the smaller value first.
- `(h2h "Stat" ORDER)` applies a conditional head-to-head comparison using the named statistic.

Rules are evaluated in the order written. The serializer preserves this order.

### Complete example

```lisp
(config
  (stat "Ballots Won" sum
    (> (pairing pointsFor) (pairing pointsAgainst)))

  (stat "Total Points" sum
    (pairing pointsFor))

  (stat "Point Differential" sum
    (- (pairing pointsFor) (pairing pointsAgainst)))

  (stat "Presider Selections" sum
    (pairing won_presider_tiebreaker))

  (team-stat "Scoring Index"
    (/ (stat "Total Points")
       (+ (stat "Ballots Won") 1)))

  (columns
    (column "Ballots Won" "Ballots")
    (column "Total Points" "Points")
    (column "Point Differential" "PD")
    (column "Presider Selections" "Presider"))

  (tiebreakers
    (by "Ballots Won" desc)
    (by "Total Points" desc)
    (by "Presider Selections" desc)
    (by "Point Differential" desc)))
```

The field names in this example must match the fields supplied by the current standings model. Use the Blockly editor as the authoritative source when confirming available fields.

### Parser errors and validation boundaries

The parser reports errors for:

- A nonempty document without a `(config ...)` root
- A config entry that is not a list
- An unknown config entry or expression operator
- An invalid aggregation or sort direction
- A quoted keyword where a bare keyword is required
- A string literal used directly as a numeric expression
- An empty expression
- A malformed column or tiebreaker entry

Some semantic problems are outside the parser's validation boundary. The parser does not verify that a field exists, a referenced statistic exists, names are unique, dependencies are acyclic, or a calculation produces a finite number. Preview and test the configuration after every advanced edit.

### Round-trip behavior

The serializer produces a canonical `(config ...)` document with quoted names and labels. It always emits both `(columns ...)` and `(tiebreakers ...)`, even when either list is empty.

Blockly-generated expressions and DSL expressions share the same internal representation. Converting DSL to blocks and back can normalize formatting, numeric spelling, parentheses, and some equivalent reference forms without changing the calculated value.

## Preview the standings

Use the preview before saving. It lets you confirm that the current rules produce the intended order without changing published results.

Check that:

- A team with a better value in the first statistic ranks higher.
- The second statistic is used only when the first statistic is tied.
- Higher and lower values are sorted in the correct direction.
- Averages and percentages behave correctly when pairings have different numbers of scorers.
- Presider selections are counted only when a presider submitted a tiebreaker choice.
- The final column labels are clear.

Try preview data that creates ties at several levels. This makes it easier to verify each rule in the sequence.

## Save and verify the configuration

When the preview matches your tournament's rules, save the configuration. Then open **Standings** and verify the column names and team order using the rounds you want to include.

If ballots have already been submitted, changing the configuration can change the displayed standings. Review the updated results before publishing them.

## Troubleshooting

### The configuration will not save

Check the editor for an error message. In the DSL editor, look for unmatched parentheses, missing values, duplicate statistic identifiers, or a tiebreaker that refers to an undefined statistic.

### Teams are sorted in the wrong direction

Review whether the statistic should rank from highest to lowest or lowest to highest. Most totals rank higher values first, while statistics such as points allowed may rank lower values first.

### A statistic displays an unexpected value

Confirm which rounds are selected in the standings and whether every pairing has the expected number of submitted ballots. For averages and percentages, verify that the calculation uses the correct divisor.

### Teams are still tied

Add another statistic to the end of the tiebreaker order if your tournament rules provide an additional method for resolving ties. If the rules permit an unresolved tie, no additional configuration is necessary.

### The presider tiebreaker is missing

Confirm that a presider was assigned and that the presider submitted a team selection for the pairing. A presider-based statistic cannot count a selection that was never recorded.

## Recommended setup process

Before the tournament begins:

1. Compare the configuration with the official tournament rules.
2. Preview at least one tie at each level of the tiebreaker order.
3. Have another organizer independently review the order and calculations.
4. Save the configuration before scorers begin submitting ballots.
5. Avoid changing the rules after results have been published unless the tournament rules require a correction.

This review is especially important because the tiebreaker configuration determines the order shown in published standings.