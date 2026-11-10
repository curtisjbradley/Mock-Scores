# Mock-Scores contributor guidance

## Project

Mock-Scores is open-source scoring and tabulation software for high-school and collegiate mock-trial tournaments. It prioritizes ease of use for tournament participants, organizer customizability, and coach transparency.

This repository is an npm-workspaces monorepo:

- `frontend/` — React 19, Vite, and TypeScript SPA.
- `backend/` — Express 5, TypeScript, PostgreSQL (`pg` with raw SQL).
- `shared/` — shared TypeScript API interfaces, published as `@mock-scores/shared`.
- `standings-dsl/` — standings/tiebreaker DSL, interpreter, and reusable Blockly/React editor, published as `@mock-scores/standings-dsl`.
- `landing/` — Astro marketing site and Starlight documentation.

The primary user roles are organizers, coaches, judges/scorers, and organizer delegates. A tournament contains its case format, scoring categories, rounds, pairings, courtrooms, teams, and scorers.

## General conventions

- TypeScript is strict: never introduce `any`; use `unknown` and narrow it, or define a proper interface.
- Prefer interfaces for object shapes. Add shared API types to `shared/src/index.ts`; put PostgreSQL row types in `backend/src/types/dbtypes.ts`.
- Preserve the established package and module style when editing a workspace; in particular, the backend is CommonJS while the standings DSL provides dual ESM/CJS builds.
- Do not add an ORM. PostgreSQL access uses parameterized raw SQL through `pg`.
- Before deleting or substantially refactoring exports, run `npx fallow dead-code`. Run `npx fallow health` after a feature, `npx fallow dupes` for suspected duplication, and `npx fallow audit` after a batch of changes when practical.
- Do not modify existing migrations. Every schema change needs a new numbered migration alongside the schema-source update.
- Do not bypass Git hooks with `--no-verify`. Use `feature/`, `fix/`, or `chore/` branch names and conventional-commit PR titles (`feat:`, `fix:`, `chore:`, `docs:`).

## Validation

Run checks scoped to the changed workspace first, then broader checks when appropriate:

- `npm run build` — build all workspaces in dependency order.
- `npm run lint` — lint all workspaces.
- `npm test` — build shared/DSL and run DSL, backend, and frontend tests.
- `npm run backend-coverage` — backend Jest coverage.

## Directory guidance

Read the closest `AGENTS.md` before changing files beneath `backend/`, `frontend/`, or `standings-dsl/`.
