# Mock-Scores

[![codecov](https://codecov.io/gh/curtisjbradley/Mock-Scores/branch/main/graph/badge.svg)](https://codecov.io/gh/curtisjbradley/Mock-Scores)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Mock-Scores is free, open-source scoring and tabulation software for high school
and collegiate mock trial tournaments. It gives organizers one place to create
tournaments, manage teams and rosters, assign courtrooms and scorers, collect
ballots, calculate standings, and publish results.

The official hosted service is available at **[app.mockscores.org](https://app.mockscores.org)**,
with documentation at **[mockscores.org/docs](https://mockscores.org/docs)**.

## Goals

- **Ease of use** — judges score from an emailed link with no account to create
- **Customizability** — organizers configure case formats, scoring, awards, and custom tiebreakers
- **Transparency** — coaches see rosters, pairings, and results as they are published

## Who it's for

- **Organizers** create and manage tournaments, configure scoring, and run rounds, pairings, and scorers.
- **Coaches** join by invitation, manage their roster, and assign students to roles per pairing.
- **Judges (scorers)** open a unique link to submit a scoresheet — no account required.

## Features

- Tournament setup wizard: case format, witnesses, scoring templates, awards, and standings
- Online and paper (offline) ballots with validation, award nominations, and presider tiebreakers
- Configurable standings and tiebreakers (ballots won, combined strength, point differential, and more)
  via a visual [Blockly](https://developers.google.com/blockly) editor or an underlying Lisp-like DSL
- Rounds, pairings, courtrooms, and scorer conflict tracking
- Real-time tabulation with CSV exports for standings, results, awards, and rosters
- JWT-based auth with email/password or Google sign-in

## Repository structure

This is an npm-workspaces monorepo:

| Workspace | Package | Description |
|---|---|---|
| `frontend/` | — | React 19 + Vite + TypeScript single-page app |
| `backend/` | — | Node.js + Express 5 + TypeScript API (PostgreSQL via `pg`, raw SQL) |
| `shared/` | `@mock-scores/shared` | Shared TypeScript interfaces used by frontend and backend |
| `standings-dsl/` | `@mock-scores/standings-dsl` | Standings/tiebreaker DSL, interpreter, and Blockly editor UI |
| `landing/` | — | Astro marketing site and Starlight documentation |

Other top-level directories: `documentation/` (database schema and migrations),
`docs/` (planning notes), `.github/` (CI workflows), and `.kiro/` (agent and steering docs).

## Tech stack

- **Frontend:** React 19, React Router 7, Vite, `react-hook-form`, Blockly
- **Backend:** Express 5 (CommonJS), PostgreSQL (`pg`, no ORM), `jose` (JWT), `nodemailer`, `express-rate-limit`
- **Shared/DSL:** TypeScript, Jest + ts-jest
- **Docs/landing:** Astro + Starlight
- **Tooling:** TypeScript (strict), ESLint, Husky + lint-staged, Codecov

## Getting started

### Prerequisites

- Node.js (LTS recommended) and npm
- A PostgreSQL database (schema in `documentation/TableSetup.sql`)

### Install

```bash
git clone https://github.com/curtisjbradley/Mock-Scores.git
cd Mock-Scores
npm install
```

### Configure

The backend requires environment variables (database connection, JWT secret, email
credentials, etc.). Configure these in `backend/` before starting the server, and
apply the schema from `documentation/TableSetup.sql` plus any files in
`documentation/migrations/` (migrations are applied manually; there is no runner).

### Run in development

```bash
# Backend API (nodemon dev server, default port 3000)
npm run dev -w backend

# Frontend SPA (Vite dev server)
npm run dev -w frontend

# Landing site + docs (Astro dev server)
npm run dev -w landing
```

## Common commands

Run from the repository root:

| Command | What it does |
|---|---|
| `npm run build` | Build all workspaces in dependency order |
| `npm run lint` | Lint frontend, backend, and landing |
| `npm test` | Build shared/DSL, then run DSL, backend, and frontend (Cypress) tests |
| `npm run backend-coverage` | Backend tests with coverage |
| `npm start` | Start the backend server |

## Testing

- **Backend:** Jest + `supertest` (integration-style route + provider tests) in `backend/testing/tests/`
- **Standings DSL:** Jest + ts-jest in `standings-dsl/src/__tests__/`
- **Frontend:** Cypress (with `cypress-axe` for accessibility)

Coverage is published to [Codecov](https://codecov.io/gh/curtisjbradley/Mock-Scores).

## Documentation

Full user documentation for organizers, coaches, and scorers lives in the Astro
Starlight site under `landing/` and is published at
[mockscores.org/docs](https://mockscores.org/docs). Highlights:

- Getting started and account management
- Organizer, coach, and scorer guides
- [Managing tiebreakers](https://mockscores.org/docs/organizer/managing-tiebreakers/) — the standings DSL grammar and visual editor
- [Scoring metrics explained](https://mockscores.org/docs/organizer/scoring-metrics/) — how combined strength, point differential, and other metrics are calculated

## Contributing

Contributions are welcome. Please note:

- Branch naming uses `feature/`, `fix/`, or `chore/` prefixes.
- PR titles follow conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- A Husky pre-commit hook runs `lint-staged` (ESLint `--fix` on staged `.ts`/`.tsx` files); do not bypass it with `--no-verify`.
- TypeScript strict mode is enabled across all workspaces; avoid `any`.

## License

Licensed under the [GNU General Public License v3.0](LICENSE). Curtis Bradley is the
principal developer and retains copyright in his contributions; other contributors
retain copyright in their respective contributions. Publishing the source code does
not make any account, tournament, or participant data public.
