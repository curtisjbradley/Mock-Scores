# Backend


## Database
The database uses Postgres. 
The following command creates all the proper tables.

```postgresql
create table auth (
    userid uuid PRIMARY KEY default gen_random_uuid(),
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    createdAt TIMESTAMP not null DEFAULT NOW(),
    firstName text not null,
    lastName text not null
);

CREATE TABLE tournaments (
    id       uuid  PRIMARY KEY default gen_random_uuid(),
    name        TEXT        NOT NULL,
    location    TEXT        NOT NULL,
    start_date  DATE,
    end_date    DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    case_name            TEXT        NOT NULL,
    criminal_case        BOOLEAN     NOT NULL DEFAULT TRUE,
    p_witnesses_called   SMALLINT NOT NULL,
    d_witnesses_called   SMALLINT NOT NULL,
    has_swing            BOOLEAN     NOT NULL DEFAULT FALSE
);


CREATE TABLE case_witnesses (
    id              uuid PRIMARY KEY default gen_random_uuid(),
    tournament_id uuid     NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    side            VARCHAR(1)    NOT NULL CHECK (side IN ('P', 'D', 'S')),
    name            TEXT    NOT NULL
);

CREATE TABLE scoring_categories (
    id              uuid PRIMARY KEY default gen_random_uuid(),
    tournament_id   uuid     NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    witness_category BOOLEAN NOT NULL DEFAULT FALSE,
    position        SMALLINT NOT NULL
);

CREATE TABLE scoring_fields (
    id                  uuid PRIMARY KEY default gen_random_uuid(),
    category_id         uuid     NOT NULL REFERENCES scoring_categories(id) ON DELETE CASCADE,
    label               TEXT    NOT NULL,
    min_score           SMALLINT NOT NULL DEFAULT 0,
    max_score           SMALLINT NOT NULL DEFAULT 10,
    multiplier          NUMERIC(5,2) NOT NULL DEFAULT 1,
    assignable          BOOLEAN NOT NULL DEFAULT TRUE,
    eligible_for_award  BOOLEAN NOT NULL DEFAULT FALSE,
    visible_to_scorers  BOOLEAN NOT NULL DEFAULT TRUE,
    prosecution         BOOLEAN NOT NULL DEFAULT FALSE,
    defense             BOOLEAN NOT NULL DEFAULT FALSE,
    calling             BOOLEAN NOT NULL DEFAULT FALSE,
    crossing            BOOLEAN NOT NULL DEFAULT FALSE,
    position            SMALLINT NOT NULL
);


create table tournament_owners
(
    tournament uuid NOT NULL references tournaments(id),
    delegate_email text NOT NULL,
    role text not null check (role in ('owner', 'delegate'))
);

```