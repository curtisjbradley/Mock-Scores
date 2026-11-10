-- Organizer-only notes attached to a tournament scorer profile.
ALTER TABLE scorers ADD COLUMN notes text NOT NULL DEFAULT '';
