-- Migration: Add share_individual_rankings to tournaments
-- Tournament-level setting. When false, coaches cannot see individual award
-- nominations on ballots. Defaults to true to preserve existing behavior.

ALTER TABLE tournaments
    ADD COLUMN share_individual_rankings boolean DEFAULT true NOT NULL;
