---
title: Mock Trial Scoring Metrics Explained
description: How mock trial scoring metrics are calculated — ballots won, combined strength (CS), point differential (PD), opponent combined strength (OCS), and strength of schedule — with worked MockScores examples.
sidebar:
  order: 6
head:
  - tag: script
    attrs:
      type: application/ld+json
    content: |
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is combined strength in mock trial?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Combined strength (CS) measures how strong a team's opponents were. It is the sum of the ballots won by every team you faced. A high combined strength means you played a difficult schedule, so it is used as a tiebreaker that rewards teams who beat tougher opponents."
            }
          },
          {
            "@type": "Question",
            "name": "How is combined strength calculated?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Add up the ballots won by each opponent a team faced across the rounds included in the standings. In MockScores this is expressed as the sum, over your pairings, of each opponent's Ballots statistic."
            }
          },
          {
            "@type": "Question",
            "name": "What is point differential in mock trial?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Point differential (PD) is the total points a team earned minus the total points scored against it, summed across its ballots. A positive point differential means the team outscored its opponents overall."
            }
          },
          {
            "@type": "Question",
            "name": "What is opponent combined strength (OCS)?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Opponent combined strength (OCS) is the sum of your opponents' combined strength values. It measures the strength of your opponents' schedules and is typically used as a deeper tiebreaker after combined strength."
            }
          }
        ]
      }
---

This page explains the statistics most mock trial tournaments use to rank and break ties between teams, and shows exactly how MockScores calculates each one. Every example uses the real [standings DSL](/docs/organizer/managing-tiebreakers/); you can paste any snippet into the editor or the [live playground](/docs/organizer/managing-tiebreakers/#try-it-now) and watch it compute.

For term definitions see the [Glossary](/docs/glossary/). For the full grammar, validation rules, and the visual Blockly editor, see [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/).

:::note
MockScores supports **AMTA-style** scoring but is not affiliated with or endorsed by the American Mock Trial Association. The metrics below are configurable; your tournament's official rules always govern.
:::

## The common ranking metrics at a glance

| Metric | Abbr. | What it measures |
|---|---|---|
| Ballots won | BW | How many judge ballots a team won |
| Combined strength | CS | How strong the team's opponents were |
| Point differential | PD | Total points for minus points against |
| Opponent combined strength | OCS | How strong the opponents' opponents were |

Most tournaments rank by ballots first, then use CS, PD, and OCS as successive tiebreakers. This is the classic AMTA-style ordering.

## Ballots won

A **ballot** is one judge's decision for one trial. A team wins a ballot when it earns more points than its opponent on that judge's scoresheet. **Ballots won** is the total number of ballots a team won across the rounds in the standings; tied ballots usually count as half.

```lisp
(stat "Ballots" sum
  (+ (pairing ballots_won)
     (* (pairing ballots_tied) 0.5)))
```

This sums, for each pairing, the ballots the team won plus half of any tied ballots. Ballots won is almost always the first ranking criterion because it directly reflects wins.

## Combined strength (CS)

**Combined strength** answers: *how strong were the teams I had to beat?* It is the sum of the **ballots won by every opponent** a team faced. Two teams with the same number of ballots are separated by combined strength so that the team who faced tougher opponents ranks higher.

```lisp
(stat "Combined Strength" sum
  (opponent "Ballots"))
```

The `(opponent "Ballots")` reference reads each opponent's own **Ballots** statistic, and `sum` adds them across every pairing. Because it depends on the **Ballots** stat, define Ballots first.

### How is combined strength calculated — worked example

Suppose Team A played three rounds against opponents who finished with 6, 4, and 7 ballots won. Team A's combined strength is `6 + 4 + 7 = 17`. A rival with the same ballot count whose opponents won `5 + 3 + 4 = 12` ballots has a lower combined strength and ranks below Team A.

## Point differential (PD)

**Point differential** is the total points a team earned minus the total points scored against it, summed across its ballots. It rewards decisive wins and is a common tiebreaker after combined strength.

```lisp
(stat "Point Differential" sum
  (- (pairing ballot_pf) (pairing ballot_pa)))
```

Here `ballot_pf` is the team's points for and `ballot_pa` is the points against, summed per ballot. A team that wins its ballots by wide margins accumulates a larger positive point differential. Some tournaments instead rank "points against" ascending (fewer points allowed is better) — both are easy to express.

## Opponent combined strength (OCS)

**Opponent combined strength** goes one level deeper: it is the sum of your **opponents' combined strength** values. It measures how strong your opponents' schedules were, and is used as a late tiebreaker when ballots, CS, and PD are all equal.

```lisp
(stat "Opponent Combined Strength" sum
  (opponent "Combined Strength"))
```

Because OCS depends on **Combined Strength**, which depends on **Ballots**, define them in that order: Ballots → Combined Strength → Opponent Combined Strength.

## Strength of schedule

"Strength of schedule" is the general idea that combined strength and opponent combined strength capture. If your rules express it differently — for example, as the *average* of opponents' ballots rather than the sum — change the aggregation:

```lisp
(stat "Avg Opponent Ballots" avg
  (opponent "Ballots"))
```

Using `avg` instead of `sum` makes the metric independent of how many rounds a team played, which matters if teams play different numbers of pairings.

## Presider selections (presider tiebreaker)

When a trial's scores are tied, the presider can record which team should win. **Presider selections** counts how many times a team won that choice, and can be used as a tiebreaker where the rules allow it.

```lisp
(stat "Presider Selections" sum
  (pairing won_presider_tb))
```

## Putting it together: the AMTA-style template

This is the standings configuration most AMTA-style tournaments use — rank by ballots, then break ties by combined strength, then point differential, then opponent combined strength:

```lisp
(config
  (stat "Ballots" sum
    (+ (pairing ballots_won) (* (pairing ballots_tied) 0.5)))

  (stat "Combined Strength" sum
    (opponent "Ballots"))

  (stat "Point Differential" sum
    (- (pairing ballot_pf) (pairing ballot_pa)))

  (stat "Opponent Combined Strength" sum
    (opponent "Combined Strength"))

  (columns
    (column "Ballots" "Ballots")
    (column "Combined Strength" "CS")
    (column "Point Differential" "PD")
    (column "Opponent Combined Strength" "OCS"))

  (tiebreakers
    (by "Ballots" desc)
    (by "Combined Strength" desc)
    (by "Point Differential" desc)
    (by "Opponent Combined Strength" desc)))
```

Paste this into the [tiebreaker playground](/docs/organizer/managing-tiebreakers/#try-it-now) to see it rank sample teams in real time. Adjust the order or swap in your own metrics to match your tournament's published rules.

## Frequently asked metric questions

### What does CS mean in mock trial?

CS stands for **combined strength** — the sum of the ballots won by all of a team's opponents. It is a strength-of-schedule tiebreaker.

### What does PD mean in mock trial?

PD stands for **point differential** — total points for minus total points against.

### What does OCS mean in mock trial?

OCS stands for **opponent combined strength** — the sum of your opponents' combined strength values, a deeper strength-of-schedule tiebreaker.

### How are mock trial ties broken?

Teams tied on the first metric are compared on the next, and so on down the configured order. If every rule ties, MockScores applies the configured rank method and, as a final deterministic step, orders alphabetically by team code. See [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/).

### Can I calculate these differently for my tournament?

Yes. Every metric here is just a DSL statistic. Change the aggregation (`sum`, `avg`, `max`, `min`, `count`), the fields, or the tiebreaker order to match your rules, then preview the result before saving.
