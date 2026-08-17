-- Migration: Add individual award categories system
--
-- How it works:
-- 1. Organizers create award categories (e.g. "Best Attorney", "Best Witness")
-- 2. Each scoring FIELD can be assigned to one award category (or none)
--    - e.g. "Direct Examination" field → "Best Attorney" category
--    - e.g. "Witness Portrayal" field → "Best Witness" category
--    - e.g. "Courtroom Decorum" field → not eligible (null)
-- 3. After submitting a ballot, the scorer nominates students for each
--    award category. The eligible students are those who were scored on
--    fields linked to that award category.

-- 1. Create the individual_award_categories table
CREATE TABLE individual_award_categories (
    id             uuid      DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    tournament_id  uuid      NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
    name           text      NOT NULL,
    min_nominees   smallint  DEFAULT 1 NOT NULL CHECK (min_nominees >= 0),
    max_nominees   smallint  DEFAULT 3 NOT NULL CHECK (max_nominees >= 1),
    CONSTRAINT award_categories_min_max_check CHECK (min_nominees <= max_nominees)
);

CREATE INDEX individual_award_categories_tournament_id_idx
    ON individual_award_categories (tournament_id);

-- 2. Add award_category_id to scoring_fields
--    Each scoring field can optionally link to an award category.
--    NULL = this field is not eligible for any individual award.
ALTER TABLE scoring_fields
    ADD COLUMN award_category_id uuid REFERENCES individual_award_categories (id) ON DELETE SET NULL;

CREATE INDEX scoring_fields_award_category_id_idx
    ON scoring_fields (award_category_id)
    WHERE award_category_id IS NOT NULL;
