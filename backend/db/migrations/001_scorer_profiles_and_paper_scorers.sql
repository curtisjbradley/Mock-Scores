-- Migration: Unify paper scorers into the scorers table, add judge profiles,
--            and add co-scoring preferences.
--
-- Why:
--   * Paper (offline) scorers were per-pairing throwaway rows in `paper_scorers`
--     with a NOT NULL pairing_id and cascade delete. Organizers had to re-type a
--     paper judge for every pairing, and such judges could not carry conflicts or
--     preferences. This migration promotes paper scorers to first-class,
--     tournament-level `scorers` rows (email nullable, is_paper = true).
--   * `scorer_pairing_assignments` previously held a registered_scorer_id XOR
--     paper_scorer_id pair. With a single scorers table this collapses to one
--     `scorer_id` FK.
--   * Adds AMTA 10.19(2)-style judge info: willing_to_preside and a "wants to
--     score with ___" co-scoring preference (soft, directional).
--   * Collapses scorer first_name/last_name into a single `name` column (judges
--     are referred to by one display name throughout the app).
--
-- Safety: additive-forward and non-destructive to scorer DATA (paper rows are
--   migrated before `paper_scorers` is dropped). Applied manually; no runner.

BEGIN;

-- 1. scorers: email becomes optional; add profile columns.
ALTER TABLE scorers ALTER COLUMN email DROP NOT NULL;
ALTER TABLE scorers ADD COLUMN is_paper boolean NOT NULL DEFAULT false;
ALTER TABLE scorers ADD COLUMN willing_to_preside boolean NOT NULL DEFAULT true;

-- A registered (online) scorer must have an email; a paper scorer need not.
ALTER TABLE scorers
    ADD CONSTRAINT scorers_email_required_when_online
        CHECK (is_paper OR email IS NOT NULL);

-- 1b. Collapse first_name/last_name into a single `name` column.
ALTER TABLE scorers ADD COLUMN name text;
UPDATE scorers SET name = btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''));
ALTER TABLE scorers ALTER COLUMN name SET NOT NULL;
ALTER TABLE scorers DROP COLUMN first_name;
ALTER TABLE scorers DROP COLUMN last_name;

-- 2. scorer_pairing_assignments: add the unified scorer_id column.
ALTER TABLE scorer_pairing_assignments
    ADD COLUMN scorer_id uuid REFERENCES scorers (scorer_id) ON DELETE CASCADE;

-- 2a. Backfill scorer_id for existing REGISTERED assignments.
UPDATE scorer_pairing_assignments
SET scorer_id = registered_scorer_id
WHERE registered_scorer_id IS NOT NULL;

-- 2b. Migrate each existing paper_scorers row into a tournament-level scorers row,
--     then point its assignment at the new scorers row. paper_scorers.name maps
--     directly to the unified scorers.name column.
DO $$
    DECLARE
        psr RECORD;
        new_scorer_id uuid;
    BEGIN
        FOR psr IN
            SELECT ps.scorer_id AS paper_id, ps.name, r.tournament_id
            FROM paper_scorers ps
                     JOIN pairings p ON p.pairing_id = ps.pairing_id
                     JOIN rounds r ON r.round_id = p.round_id
            LOOP
                INSERT INTO scorers (tournament_id, name, email, is_paper, willing_to_preside)
                VALUES (psr.tournament_id, psr.name, NULL, true, true)
                RETURNING scorer_id INTO new_scorer_id;

                UPDATE scorer_pairing_assignments
                SET scorer_id = new_scorer_id
                WHERE paper_scorer_id = psr.paper_id;
            END LOOP;
    END $$;

-- 2c. scorer_id is now populated for every assignment; make it NOT NULL and drop the
--     old XOR columns, their check constraint, and the paper_scorers table.
ALTER TABLE scorer_pairing_assignments
    ALTER COLUMN scorer_id SET NOT NULL;

ALTER TABLE scorer_pairing_assignments
    DROP CONSTRAINT IF EXISTS scorer_pairing_assignments_check;

ALTER TABLE scorer_pairing_assignments DROP COLUMN registered_scorer_id;
ALTER TABLE scorer_pairing_assignments DROP COLUMN paper_scorer_id;

CREATE INDEX IF NOT EXISTS scorer_pairing_assignments_scorer_id_idx
    ON scorer_pairing_assignments (scorer_id);

DROP TABLE paper_scorers;

-- 3. Co-scoring preference: "this scorer wants to score with that scorer".
--    Soft and directional; the auto-assign algorithm treats it as a hint, not a rule.
CREATE TABLE scorer_coscoring_preferences
(
    id                  uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    scorer_id           uuid NOT NULL REFERENCES scorers (scorer_id) ON DELETE CASCADE,
    preferred_scorer_id uuid NOT NULL REFERENCES scorers (scorer_id) ON DELETE CASCADE,
    UNIQUE (scorer_id, preferred_scorer_id),
    CONSTRAINT scorer_coscoring_preferences_distinct CHECK (scorer_id <> preferred_scorer_id)
);

CREATE INDEX scorer_coscoring_preferences_scorer_id_idx
    ON scorer_coscoring_preferences (scorer_id);
CREATE INDEX scorer_coscoring_preferences_preferred_scorer_id_idx
    ON scorer_coscoring_preferences (preferred_scorer_id);

COMMIT;
