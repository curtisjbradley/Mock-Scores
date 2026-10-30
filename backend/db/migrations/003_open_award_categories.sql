BEGIN;

ALTER TABLE individual_award_categories
    ADD COLUMN open_to_all boolean NOT NULL DEFAULT false;
COMMIT;
