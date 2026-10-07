---
title: Frequently Asked Questions
description: Answers to common questions about MockScores — cost, hosting, data, online and paper scoring, and how tournaments run.
sidebar:
  order: 4
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
            "name": "Is MockScores free to use?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. MockScores is free, open-source software, and the official hosted service at app.mockscores.org is provided at no cost by the San Luis Obispo County Mock Trial Committee."
            }
          },
          {
            "@type": "Question",
            "name": "Do scorers and judges need an account?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. Scorers receive a unique ballot link by email and never create an account. Only organizers and coaches sign in."
            }
          },
          {
            "@type": "Question",
            "name": "Can MockScores run an online or hybrid tournament?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Courtrooms can be physical rooms or online meeting locations, and scorers submit ballots from any device with a browser and internet connection."
            }
          },
          {
            "@type": "Question",
            "name": "Does MockScores support paper ballots?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Organizers can create paper (offline) scorer assignments, print ballots, and enter the scores by hand after the trial."
            }
          }
        ]
      }
---

This page answers questions that come up before and during a tournament. For step-by-step instructions, follow the role guides linked from the [documentation overview](/docs/).

## About MockScores

### Is MockScores really free?

Yes. MockScores is free, open-source software licensed under GPL-3.0. The official hosted service at [app.mockscores.org](https://app.mockscores.org) is operated at no cost by the San Luis Obispo County Mock Trial Committee.

### Who runs the hosted service, and where does my data live?

The hosted service is operated by the San Luis Obispo County Mock Trial Committee. Account, tournament, ballot, and participant data are kept in house and are never sold. Publishing the source code does not make any tournament data public. See the [Privacy Policy](/privacy) for details.

### Can I host MockScores myself?

Yes. The source code is available on [GitHub](https://github.com/curtisjbradley/Mock-Scores) under GPL-3.0, so you can run your own installation. These guides describe the official hosted service; a self-hosted instance behaves the same way but is operated by you.

## Tournaments and formats

### Does MockScores work for high school and collegiate tournaments?

Yes. MockScores is built for high school and collegiate mock trial. You define your own case, witnesses, scoring fields, awards, and standings rules, so it adapts to most rule sets.

### Does it support AMTA-style cases with swing witnesses?

Yes. When creating or editing a tournament, enable **Case has swing witnesses** and add the swing witness names. Swing witnesses count as available to both sides when MockScores validates witnesses called per trial. See [Creating a Tournament](/docs/organizer/creating-a-tournament/).

### Can I reuse a setup for an annual competition?

Yes. Duplicate a prior tournament and choose which structures to copy — case format, witnesses, scoring, awards, scorers, courtrooms, and tiebreakers. Teams, rounds, pairings, and results are not copied. See [Managing Tournament Settings](/docs/organizer/managing-tournament-settings/).

### Can I customize how standings and tiebreakers are calculated?

Yes. Start from a template or build your own rules with the visual Blockly editor or the underlying DSL. See [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/), which includes a live playground and the full DSL grammar, and [Mock Trial Scoring Metrics Explained](/docs/organizer/scoring-metrics/) for how combined strength, point differential, and other metrics are calculated.

## Scoring

### Do judges need to install anything or create an account?

No. Each scorer receives a unique link by email and scores in their browser. There is no scorer dashboard and no account. See the [Scorer Guide](/docs/scorer/).

### Can I run a tournament online or hybrid?

Yes. Add courtrooms as physical rooms or online meeting locations, and scorers submit from any device with a browser and reliable internet. See [Managing Scorers and Courtrooms](/docs/organizer/managing-scorers-and-courtrooms/).

### What if a scorer never submits a ballot?

An organizer can enter the ballot manually from the pairing, which invalidates the scorer's original link. For a planned paper judge, create a paper scorer and enter the scores after the trial. See [Paper and Offline Ballots](/docs/scorer/paper-ballots/) and [Managing Ballots and Results](/docs/organizer/managing-ballots-and-results/).

### A scorer reported a conflict. What now?

The pairing shows **Conflict Reported** and the original link stops working. Assign a replacement scorer, confirm the replacement has no recorded conflict, and send the replacement's link after the round is locked.

## Access and accounts

### I'm a coach and my team doesn't appear. Why?

Your account email must exactly match the address the organizer used for the invitation. Sign in with that address, or ask the organizer to correct or resend the invitation. See [Getting Started](/docs/getting-started/).

### How do I reset my password or delete my account?

See [Managing Your Account](/docs/managing-your-account/) for password resets, sign-out, and permanent account deletion.

## Still need help?

If a guide does not answer your question, [send a message](https://app.mockscores.org/contact) and include the tournament name, the page you were using, and what happened. Do not include passwords or private ballot links.
