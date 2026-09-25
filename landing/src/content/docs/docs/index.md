---

title: MockScores Documentation
description: Learn how to set up, manage, and run mock trial tournaments with MockScores.

hero:
title: MockScores Documentation
tagline: Step-by-step help for organizers, coaches, and scorers.
actions:
- text: Get started
link: /docs/getting-started/
icon: right-arrow
variant: primary
- text: Open MockScores
link: https://app.mockscores.org
icon: external
variant: minimal

sidebar:
label: Overview
order: 1
--------

# Welcome to MockScores

MockScores is free, open-source software for running mock trial tournaments.

It gives organizers one place to create tournaments, manage teams and rosters, assign courtrooms and scorers, collect
ballots, calculate standings, and publish results.

Whether you are preparing your first tournament or managing a large competition, these guides will walk you through the
process.

## Start here

### Organizers

Organizers create and manage tournaments. They can:

* Configure the case, witnesses, ballots, awards, and tiebreakers
* Add teams, coaches, scorers, and courtrooms
* Create rounds and pairings
* Assign scorers and select presiders
* Monitor ballot submissions
* Review and publish results

Start with [Getting Started](/docs/getting-started/), then learn how
to [create a tournament](/docs/organizer/creating-a-tournament/).

### Coaches

Coaches join tournaments through an invitation from an organizer. They can:

* Manage their team roster
* Assign students to scoring roles
* Select witness call orders
* Review pairings and completed ballots
* View published results

See [Getting Started](/docs/getting-started/) for instructions on accessing an invited team.

### Scorers and judges

Scorers do not need to create an account. They receive an email containing a unique link to their assigned ballot.

From the ballot, scorers can:

* Enter scores
* Select award nominations
* Choose a tiebreaker winner when serving as the presider
* Review and submit the completed ballot

Scorers should bring a device with internet and email access to the tournament.

## Tournament setup workflow

A typical tournament setup follows these steps:

1. Create the tournament.
2. Configure the case, witnesses, and ballot.
3. Choose or create the standings rules.
4. Add teams and coaches.
5. Add courtrooms and scorers.
6. Create and publish rounds and pairings.
7. Wait for teams to assign their call orders and student assignments.
8. Assign scorers and select a presider for each trial.
9. Lock rounds.
10. Send out ballot links
11. Collect and review ballots.
12. Publish the results.

Tournament requirements differ, so you can return to the tournament dashboard and update most settings as your
competition takes shape.

## Configurable standings

MockScores supports custom standings and tiebreaker rules. Organizers can begin with a template or create their own
configuration using a visual Blockly editor.

Advanced users can work directly with the underlying Lisp-like DSL.

See [Managing Tiebreakers](/docs/organizer/managing-tiebreakers/) for setup instructions and the complete DSL grammar.

## Need help during a tournament?

* Search this documentation for instructions related to your task.
* Return to the relevant tournament dashboard and check for validation or status messages.
* [Send a message](https://app.mockscores.org/contact) if you cannot resolve the problem.

When requesting help, include the tournament name, the page you were using, and a description of what happened. Do not
include passwords or private ballot links.
