-- Keep default configurations for prosecution/plaintiff and defense separate.
-- Existing rows predate side-aware assignments, so preserve them as P-side rows.

BEGIN;

ALTER TABLE student_assignments
    ADD COLUMN side char(1) NOT NULL DEFAULT 'P' CHECK (side IN ('P', 'D'));
ALTER TABLE default_student_assignments
    ADD COLUMN side char(1) NOT NULL DEFAULT 'P' CHECK (side IN ('P', 'D'));
ALTER TABLE default_witness_call_order
    ADD COLUMN side char(1) NOT NULL DEFAULT 'P' CHECK (side IN ('P', 'D'));

ALTER TABLE student_assignments
    DROP CONSTRAINT student_assignments_pairing_team_field_witness_key,
    ADD CONSTRAINT student_assignments_pairing_team_field_witness_key
        UNIQUE (pairing_id, team_id, field_id, witness_id, side);

ALTER TABLE default_student_assignments
    DROP CONSTRAINT default_student_assignments_team_id_field_id_witness_id_key,
    ADD CONSTRAINT default_student_assignments_team_field_witness_side_key
        UNIQUE (team_id, field_id, witness_id, side);

ALTER TABLE default_witness_call_order
    DROP CONSTRAINT default_witness_call_order_team_id_position_key,
    ADD CONSTRAINT default_witness_call_order_team_side_position_key
        UNIQUE (team_id, side, position);

COMMIT;
