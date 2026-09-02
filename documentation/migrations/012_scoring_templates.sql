-- Migration: Move scoring templates into the database
--
-- Scoring templates were previously hardcoded in the frontend
-- (frontend/src/organizer/data/templates.ts). This migration stores them in
-- the database so they can be managed without a frontend redeploy, mirroring
-- the existing standings_templates pattern.
--
-- A scoring template bundles:
--   • scoring categories (each with ordered scoring fields)
--   • individual award categories (e.g. "Best Attorney", "Best Witness")
--   • field → award-category links (a field nominates toward an award category)
--
-- The "Manual" option is NOT stored here; it is represented client-side as the
-- absence of a template.

-- ── Tables ──────────────────────────────────────────────────────────────────

ALTER TABLE scoring_fields drop column if exists eligible_for_award ;

-- Allow negative multipliers (e.g. a -1 multiplier for point deductions).
-- Previously multiplier was constrained to >= 0; deductions need a negative
-- multiplier so a positive score entry subtracts points. Zero is still invalid.
ALTER TABLE scoring_fields DROP CONSTRAINT IF EXISTS scoring_fields_multiplier_check;
ALTER TABLE scoring_fields ADD CONSTRAINT scoring_fields_multiplier_check CHECK (multiplier <> 0);

CREATE TABLE scoring_templates (
                                   id          uuid     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                   label       text     NOT NULL,
                                   description text     NOT NULL
);

CREATE TABLE scoring_template_award_categories (
                                                   id           uuid     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                                   template_id  uuid     NOT NULL REFERENCES scoring_templates (id) ON DELETE CASCADE,
                                                   name         text     NOT NULL,
                                                   min_nominees smallint DEFAULT 1 NOT NULL CHECK (min_nominees >= 0),
                                                   max_nominees smallint DEFAULT 3 NOT NULL CHECK (max_nominees >= 1),
                                                   CONSTRAINT scoring_template_award_min_max_check CHECK (min_nominees <= max_nominees)
);

CREATE INDEX scoring_template_award_categories_template_id_idx
    ON scoring_template_award_categories (template_id);

CREATE TABLE scoring_template_categories (
                                             id               uuid     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                             template_id      uuid     NOT NULL REFERENCES scoring_templates (id) ON DELETE CASCADE,
                                             name             text     NOT NULL,
                                             witness_category boolean  DEFAULT false NOT NULL,
                                             position int not null);

CREATE INDEX scoring_template_categories_template_id_idx
    ON scoring_template_categories (template_id);

CREATE TABLE scoring_template_fields (
                                         id                  uuid          DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
                                         template_category_id uuid         NOT NULL REFERENCES scoring_template_categories (id) ON DELETE CASCADE,
                                         label               text          NOT NULL,
                                         min_score           smallint      DEFAULT 0 NOT NULL,
                                         max_score           smallint      DEFAULT 10 NOT NULL,
                                         multiplier          numeric(5, 2) DEFAULT 1 NOT NULL CHECK (multiplier <> 0),
                                         assignable          boolean       DEFAULT true NOT NULL,
                                         eligible_for_award  boolean       DEFAULT false NOT NULL,
                                         visible_to_scorers  boolean       DEFAULT true NOT NULL,
                                         prosecution         boolean       DEFAULT false NOT NULL,
                                         defense             boolean       DEFAULT false NOT NULL,
                                         calling             boolean       DEFAULT false NOT NULL,
                                         crossing            boolean       DEFAULT false NOT NULL,
                                         position            smallint      NOT NULL,
                                         award_category_id   uuid          REFERENCES scoring_template_award_categories (id) ON DELETE SET NULL
);

CREATE INDEX scoring_template_fields_category_id_idx
    ON scoring_template_fields (template_category_id);

-- ── Seed: built-in templates ─────────────────────────────────────────────────
-- Uses a PL/pgSQL block so award-category ids can be resolved by name when
-- linking template fields.
DO $$
    DECLARE
        v_template   uuid;
        v_attorney   uuid;
        v_witness    uuid;
        v_cat        uuid;
        v_pretrial uuid;
        v_clerk uuid;
        v_bailiff uuid;
    BEGIN
        -- ============================================================
        -- Template: Teach Democracy Default
        -- ============================================================
        INSERT INTO scoring_templates (label, description)
        VALUES ('Teach Democracy Default', 'Standard Teach Democracy scoring format')
        RETURNING id INTO v_template;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Pretrial', 1, 1) RETURNING id INTO v_pretrial;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Attorney', 4, 4) RETURNING id INTO v_attorney;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Witness', 4, 4) RETURNING id INTO v_witness;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Clerk', 0, 1) RETURNING id INTO v_clerk;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Bailiff', 0, 1) RETURNING id INTO v_bailiff;

        -- Pretrial
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Pretrial', false, 0) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, defense, position, award_category_id)
        VALUES (v_cat, 'Pretrial D', 2, true, 0,v_pretrial);
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, award_category_id, prosecution, position)
        VALUES (v_cat, 'Pretrial P', 2, v_pretrial, true, 1);

        -- Opening
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Opening', false, 1) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Opening', true, true, v_attorney, 0);

        -- Witnesses
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Witnesses', true, 2) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Atty Direct', true, v_attorney, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, crossing, award_category_id, position)
        VALUES (v_cat, 'Atty Cross', true, v_attorney, 1);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness', true, v_witness, 2);

        -- Closing
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Closing', false, 3) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Closing', 2, true, true, v_attorney, 0);

        -- Clerk / Bailiff
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Clerk / Bailiff', false, 4) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, prosecution, position)
        VALUES (v_cat, 'Clerk', 5, v_clerk, true, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, defense, position)
        VALUES (v_cat, 'Bailiff', 5, v_bailiff, true, 1);

        -- Team Score
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Team Score', false, 5) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, assignable, prosecution, defense, position)
        VALUES (v_cat, 'Team Score', false, true, true, 0);

        -- Point Deductions
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Point Deductions', false, 6) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, prosecution, defense, position)
        VALUES (v_cat, 'Deductions', 0, 100, -1, false, false, true, true, 0);

        -- ============================================================
        -- Template: SLO County
        -- ============================================================
        INSERT INTO scoring_templates (label, description)
        VALUES ('SLO County', 'SLO County scoring format')
        RETURNING id INTO v_template;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Pretrial', 0, 2) RETURNING id INTO v_pretrial;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Attorney', 0, 8) RETURNING id INTO v_attorney;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Witness', 0, 8) RETURNING id INTO v_witness;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Clerk', 0, 1) RETURNING id INTO v_clerk;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Bailiff', 0, 1) RETURNING id INTO v_bailiff;

        -- Pretrial
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Pretrial', false, 0) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, defense, position, award_category_id)
        VALUES (v_cat, 'Pretrial D', 2, true, 0,v_pretrial);
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, award_category_id, prosecution, position)
        VALUES (v_cat, 'Pretrial P', 2, v_pretrial, true, 1);

        -- Opening
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Opening', false, 1) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Opening', true, true, v_attorney, 0);

        -- Witnesses
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Witnesses', true, 2) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Atty Direct', true, v_attorney, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, crossing, award_category_id, position)
        VALUES (v_cat, 'Atty Cross', true, v_attorney, 1);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness', true, v_witness, 2);

        -- Closing
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Closing', false, 3) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Closing', 2, true, true, v_attorney, 0);

        -- Clerk / Bailiff
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Clerk / Bailiff', false, 4) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, prosecution, position)
        VALUES (v_cat, 'Clerk', 10, v_clerk, true, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, defense, position)
        VALUES (v_cat, 'Bailiff', 10, v_bailiff, true, 1);

        -- Team Score
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Team Score', false, 5) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, assignable, prosecution, defense, position)
        VALUES (v_cat, 'Team Score', false, true, true, 0);

        -- Point Deductions
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Point Deductions', false, 6) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, min_score, max_score, multiplier, assignable, prosecution, defense, position)
        VALUES (v_cat, 'Deductions', 0, 100, -1, false, true, true, 0);


        -- ============================================================
        -- Template: AMTA
        -- ============================================================
        INSERT INTO scoring_templates (label, description)
        VALUES ('AMTA Regular', 'College Mock Trial Format. 3 Attorneys + 3 Witnesses.')
        RETURNING id INTO v_template;


        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Attorney', 4, 4) RETURNING id INTO v_attorney;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Witness', 4, 4) RETURNING id INTO v_witness;

        -- Opening
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Opening', false, 0) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Opening', true, true, v_attorney, 0);

        -- Witnesses
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Witnesses', true, 1) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Atty Direct', true, v_attorney, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness Direct', true, v_witness, 1);
        INSERT INTO scoring_template_fields (template_category_id, label, crossing, award_category_id, position)
        VALUES (v_cat, 'Atty Cross', true, v_attorney, 2);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness Cross', true, v_witness, 3);


        -- Closing
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Closing', false, 2) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Closing', 1, true, true, v_attorney, 0);

        -- Point Deductions
        INSERT INTO scoring_template_categories (template_id, name, witness_category,  position)
        VALUES (v_template, 'Point Deductions', false, 6) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, min_score, max_score, multiplier, assignable, prosecution, defense, position, visible_to_scorers)
        VALUES (v_cat, 'Deductions', 0, 100, -1, false, true, true, 0, false);
    END $$;
