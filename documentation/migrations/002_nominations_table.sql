-- Migration: Create nominations table
-- Stores individual award nominations as structured rows instead of only in ballot_json JSONB.

CREATE TABLE nominations (
    id                 uuid     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    ballot_id          uuid     NOT NULL REFERENCES ballots (ballot_id) ON DELETE CASCADE,
    award_category_id  uuid     NOT NULL REFERENCES individual_award_categories (id) ON DELETE CASCADE,
    student_id         uuid     NOT NULL REFERENCES team_rostered_students (student_id) ON DELETE CASCADE,
    rank               smallint NOT NULL CHECK (rank >= 1)
);

CREATE INDEX nominations_ballot_id_idx ON nominations (ballot_id);
CREATE INDEX nominations_award_category_id_idx ON nominations (award_category_id);
CREATE INDEX nominations_student_id_idx ON nominations (student_id);

-- Prevent duplicate nomination of same student in same category on same ballot
CREATE UNIQUE INDEX nominations_unique_idx ON nominations (ballot_id, award_category_id, student_id);
