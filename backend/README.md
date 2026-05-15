# Backend

## Database

The database uses Postgres.
The following command creates all the proper tables.

```postgresql
CREATE TABLE auth
(
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    password_hash TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL
);

CREATE TABLE tournaments
(
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT NOT NULL,
    location             TEXT NOT NULL,
    start_date           DATE,
    end_date             DATE,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    case_name            TEXT NOT NULL,
    criminal_case        BOOLEAN NOT NULL DEFAULT TRUE,
    p_witnesses_called   SMALLINT NOT NULL,
    d_witnesses_called   SMALLINT NOT NULL,
    has_swing            BOOLEAN NOT NULL DEFAULT FALSE,

    CHECK (
        start_date IS NULL
            OR end_date IS NULL
            OR start_date <= end_date
        )
);

CREATE TABLE case_witnesses
(
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    side          VARCHAR(1) NOT NULL CHECK (side IN ('P', 'D', 'S')),
    name          TEXT NOT NULL
);

CREATE TABLE scoring_categories
(
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id     UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    witness_category  BOOLEAN NOT NULL DEFAULT FALSE,
    position          SMALLINT NOT NULL,

    UNIQUE (tournament_id, position)
);

CREATE TABLE scoring_fields
(
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id          UUID NOT NULL REFERENCES scoring_categories(id) ON DELETE CASCADE,
    label                TEXT NOT NULL,
    min_score            SMALLINT NOT NULL DEFAULT 0,
    max_score            SMALLINT NOT NULL DEFAULT 10,
    multiplier           NUMERIC(5,2) NOT NULL DEFAULT 1,
    assignable           BOOLEAN NOT NULL DEFAULT TRUE,
    eligible_for_award   BOOLEAN NOT NULL DEFAULT FALSE,
    visible_to_scorers   BOOLEAN NOT NULL DEFAULT TRUE,
    prosecution          BOOLEAN NOT NULL DEFAULT FALSE,
    defense              BOOLEAN NOT NULL DEFAULT FALSE,
    calling              BOOLEAN NOT NULL DEFAULT FALSE,
    crossing             BOOLEAN NOT NULL DEFAULT FALSE,
    position             SMALLINT NOT NULL,

    CHECK (min_score <= max_score),
    CHECK (multiplier >= 0),

    UNIQUE (category_id, position)
);

CREATE TABLE tournament_owners
(
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    delegate_id   UUID NOT NULL REFERENCES auth(user_id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('owner', 'delegate')),

    PRIMARY KEY (tournament_id, delegate_id)
);

CREATE TABLE tournament_delegate_invites
(
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL
);

CREATE TABLE scorers
(
    scorer_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id  UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id        UUID REFERENCES auth(user_id) ON DELETE SET NULL,
    first_name     TEXT NOT NULL,
    last_name      TEXT NOT NULL,
    email          TEXT NOT NULL
);

CREATE TABLE courtrooms
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id  UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    location       TEXT,

    UNIQUE (tournament_id, name)
);

CREATE TABLE teams
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id  UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    code           TEXT NOT NULL,

    UNIQUE (tournament_id, name),
    UNIQUE (tournament_id, code)
);

CREATE TABLE team_invites
(
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    invite_email  TEXT NOT NULL,
    name          TEXT NOT NULL,
    code          TEXT NOT NULL
);

CREATE TABLE team_coaches
(
    coach_id   UUID NOT NULL REFERENCES auth(user_id) ON DELETE CASCADE,
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    is_owner   BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (coach_id, team_id)
);

```