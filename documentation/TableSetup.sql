create table auth
(
    user_id       uuid      default gen_random_uuid() not null
        primary key,
    password_hash text                                not null,
    email         text                                not null
        unique,
    created_at    timestamp default now()             not null,
    first_name    text                                not null,
    last_name     text                                not null
);
create table tournament_format
(
    format_id          uuid primary key default gen_random_uuid(),
    case_name          text                          not null,
    criminal_case      boolean          default true not null,
    p_witnesses_called smallint                      not null,
    d_witnesses_called smallint                      not null,
    has_swing          boolean          default false
);


create table tournaments
(
    id             uuid      default gen_random_uuid() not null
        primary key,
    name           text                                not null,
    location       text                                not null,
    start_date     date,
    end_date       date,
    created_at     timestamp default now()             not null,
    case_format_id uuid                                not null references tournament_format (format_id),
    num_rounds     smallint  default 0                 not null,
    num_teams      smallint  default 0                 not null,
    constraint tournaments_check
        check ((start_date IS NULL) OR (end_date IS NULL) OR (start_date <= end_date))
);


create table case_witnesses
(
    id          uuid default gen_random_uuid() not null
        primary key,
    case_format uuid                           not null
        references tournament_format (format_id)
            on delete cascade,
    side        varchar(1)                     not null
        constraint case_witnesses_side_check
            check ((side)::text = ANY
                   ((ARRAY ['P'::character varying, 'D'::character varying, 'S'::character varying])::text[])),
    name        text                           not null
);


create table scoring_categories
(
    id               uuid    default gen_random_uuid() not null
        primary key,
    tournament_id    uuid                              not null
        references tournaments
            on delete cascade,
    name             text                              not null,
    witness_category boolean default false             not null,
    position         smallint                          not null,
    unique (tournament_id, position)
);


create table scoring_fields
(
    id                 uuid          default gen_random_uuid() not null
        primary key,
    category_id        uuid                                    not null
        references scoring_categories
            on delete cascade,
    label              text                                    not null,
    min_score          smallint      default 0                 not null,
    max_score          smallint      default 10                not null,
    multiplier         numeric(5, 2) default 1                 not null
        constraint scoring_fields_multiplier_check
            check (multiplier >= (0)::numeric),
    assignable         boolean       default true              not null,
    eligible_for_award boolean       default false             not null,
    visible_to_scorers boolean       default true              not null,
    prosecution        boolean       default false             not null,
    defense            boolean       default false             not null,
    calling            boolean       default false             not null,
    crossing           boolean       default false             not null,
    position           smallint                                not null,
    unique (category_id, position),
    constraint scoring_fields_check
        check (min_score <= max_score)
);



create table tournament_owners
(
    id            uuid primary key default gen_random_uuid(),
    tournament_id uuid not null
        references tournaments
            on delete cascade,
    delegate_id   uuid not null
        references auth
            on delete cascade,
    role          text not null
        constraint tournament_owners_role_check
            check (role = ANY (ARRAY ['owner'::text, 'delegate'::text])),
    unique (tournament_id, delegate_id)
);



create table tournament_delegate_invites
(
    id            uuid default gen_random_uuid() not null
        primary key,
    tournament_id uuid                           not null
        references tournaments
            on delete cascade,
    name          text                           not null,
    email         text                           not null
);



create table scorers
(
    scorer_id     uuid default gen_random_uuid() not null
        primary key,
    tournament_id uuid                           not null
        references tournaments
            on delete cascade,
    first_name    text                           not null,
    last_name     text                           not null,
    email         text                           not null
);



create table courtrooms
(
    id            uuid default gen_random_uuid() not null
        primary key,
    tournament_id uuid                           not null
        references tournaments
            on delete cascade,
    name          text                           not null,
    location      text,
    unique (tournament_id, name)
);



create table teams
(
    id            uuid default gen_random_uuid() not null
        primary key,
    tournament_id uuid                           not null
        references tournaments
            on delete cascade,
    name          text                           not null,
    code          text                           not null,
    unique (tournament_id, name),
    unique (tournament_id, code)
);



create table team_invites
(
    id           uuid default gen_random_uuid() not null
        primary key,
    team_id      uuid                           not null
        references teams
            on delete cascade,
    invite_email text                           not null,
    name         text                           not null,
    code         text                           not null
);



create table team_coaches
(
    coach_id uuid                  not null
        references auth
            on delete cascade,
    team_id  uuid                  not null
        references teams
            on delete cascade,
    is_owner boolean default false not null,
    primary key (coach_id, team_id)
);



create table rounds
(
    round_id       uuid             default gen_random_uuid() not null
        primary key,
    tournament_id  uuid    not null
        references tournaments
            on delete cascade,
    results_public boolean not null default false,
    teams_public   boolean not null default false,
    position       smallint         default 1 not null,
    name           text    not null,
    round_time     timestamp with time zone,
    unique (tournament_id, position)
);



create table pairings
(
    pairing_id uuid default gen_random_uuid() not null
        primary key,
    round_id   uuid                           not null
        references rounds
            on delete cascade,
    p_team     uuid                           not null
        references teams
            on delete cascade,
    d_team     uuid                           not null
        references teams
            on delete cascade,
    courtroom  uuid
        references courtrooms
            on delete cascade,
    unique (round_id, p_team),
    unique (round_id, d_team)
);

create table paper_scorers
(
    scorer_id  uuid default gen_random_uuid() not null
        primary key,
    pairing_id uuid                           not null
        references pairings
            on delete cascade,
    name       text                           not null
);



create table scorer_pairing_assignments
(
    assignment_id        uuid default gen_random_uuid() not null
        primary key,
    registered_scorer_id uuid
        references scorers
            on delete cascade,
    paper_scorer_id      uuid
        references paper_scorers
            on delete cascade,
    pairing_id           uuid                           not null
        references pairings
            on delete cascade,
    constraint scorer_pairing_assignments_check
        check (((registered_scorer_id IS NOT NULL) AND (paper_scorer_id IS NULL)) OR
               ((registered_scorer_id IS NULL) AND (paper_scorer_id IS NOT NULL)))
);



create table scorer_presider_assignment
(
    presider_assignment_id uuid    default gen_random_uuid() not null
        primary key,
    scorer_assignment_id   uuid                              not null
        references scorer_pairing_assignments
            on delete cascade,
    pairing_id             uuid                              not null
        unique
        references pairings,
    show_scores            boolean default true              not null
);



create table team_rostered_students
(
    student_id   uuid primary key default gen_random_uuid(),
    team_id      uuid not null references teams (id) on delete cascade,
    student_name text not null,
    unique (team_id, student_name)
);

create function update_tournament_num_rounds() returns trigger
    language plpgsql
as
$$
begin
    update tournaments
    set num_rounds = (select count(*)
                      from rounds
                      where tournament_id = coalesce(new.tournament_id, old.tournament_id))
    where id = coalesce(new.tournament_id, old.tournament_id);

    return null;
end;
$$;


create function update_tournament_num_teams() returns trigger
    language plpgsql
as
$$
begin
    update tournaments
    set num_teams = (select count(*)
                     from teams
                     where tournament_id = coalesce(new.tournament_id, old.tournament_id))
    where id = coalesce(new.tournament_id, old.tournament_id);

    return null;
end;
$$;



CREATE TRIGGER trg_update_num_teams
    AFTER INSERT OR UPDATE OR DELETE
    ON teams
    FOR EACH ROW
EXECUTE FUNCTION update_tournament_num_teams();

CREATE TRIGGER trg_update_num_rounds
    AFTER INSERT OR UPDATE OR DELETE
    ON rounds
    FOR EACH ROW
EXECUTE FUNCTION update_tournament_num_rounds();
