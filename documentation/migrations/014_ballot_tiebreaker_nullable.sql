-- Migration: Make ballots.tiebreaker nullable (default NULL)
-- Only the presiding scorer's ballot carries a tiebreaker; every other ballot
-- now stores NULL. Previously the column was NOT NULL with a hard-coded sentinel
-- UUID default ('10db69a9-7596-49e8-9591-b48d0cd28c58') standing in for "no
-- tiebreaker". This drops the NOT NULL constraint and sentinel default, and
-- backfills existing sentinel rows to NULL.

ALTER TABLE ballots
    ALTER COLUMN tiebreaker DROP NOT NULL,
    ALTER COLUMN tiebreaker DROP DEFAULT;

UPDATE ballots
    SET tiebreaker = NULL
    WHERE tiebreaker = '10db69a9-7596-49e8-9591-b48d0cd28c58';
