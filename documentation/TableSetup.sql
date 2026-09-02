-- Mock-Scores Complete Schema Definition
-- This file represents the current live database schema.
-- All migrations (001–012) have been folded in.

create table auth
(
    user_id        uuid      default gen_random_uuid() not null
        primary key,
    password_hash  text,
    email          text                                not null
        unique,
    created_at     timestamp default now()             not null,
    first_name     text                                not null,
    last_name      text                                not null,
    email_verified boolean   default false             not null
);

create index auth_email_lower_idx on auth (lower(email));

create table refresh_tokens
(
    id         uuid      default gen_random_uuid() not null primary key,
    user_id    uuid                                not null
        references auth (user_id) on delete cascade,
    token_hash text                                not null unique,
    expires_at timestamp                           not null,
    created_at timestamp default now()             not null
);

create index refresh_tokens_hash_idx    on refresh_tokens (token_hash);
create index refresh_tokens_expires_idx on refresh_tokens (expires_at);

create table tournament_format
(
    format_id          uuid primary key default gen_random_uuid(),
    case_name          text                          not null,
    criminal_case      boolean          default true not null,
    p_witnesses_called smallint                      not null,
    d_witnesses_called smallint                      not null,
    has_swing          boolean          default false
);

create table standings_configs
(
    id            uuid default gen_random_uuid() not null primary key,
    stats_xml     text                           not null,
    standings_xml text                           not null
);

create table standings_templates
(
    id          uuid default gen_random_uuid() not null primary key,
    label       text                           not null,
    description text default ''                not null,
    config_id   uuid                           not null
        references standings_configs (id) on delete cascade
);

create index standings_templates_config_id_idx on standings_templates (config_id);

create table scoring_templates
(
    id          uuid     default gen_random_uuid() not null primary key,
    label       text                               not null,
    description text     default ''                not null,
    position    smallint default 0                 not null
);

create table scoring_template_award_categories
(
    id           uuid     default gen_random_uuid() not null primary key,
    template_id  uuid                               not null
        references scoring_templates (id) on delete cascade,
    name         text                               not null,
    min_nominees smallint default 1                 not null
        constraint scoring_template_award_min_nominees_check check (min_nominees >= 0),
    max_nominees smallint default 3                 not null
        constraint scoring_template_award_max_nominees_check check (max_nominees >= 1),
    constraint scoring_template_award_min_max_check check (min_nominees <= max_nominees)
);

create index scoring_template_award_categories_template_id_idx
    on scoring_template_award_categories (template_id);

create table scoring_template_categories
(
    id               uuid     default gen_random_uuid() not null primary key,
    template_id      uuid                               not null
        references scoring_templates (id) on delete cascade,
    name             text                               not null,
    witness_category boolean  default false             not null,
    position         smallint                           not null
);

create index scoring_template_categories_template_id_idx
    on scoring_template_categories (template_id);

create table scoring_template_fields
(
    id                   uuid          default gen_random_uuid() not null primary key,
    template_category_id uuid                                    not null
        references scoring_template_categories (id) on delete cascade,
    label                text                                    not null,
    min_score            smallint      default 0                 not null,
    max_score            smallint      default 10                not null,
    multiplier           numeric(5, 2) default 1                 not null
        constraint scoring_template_fields_multiplier_check check (multiplier <> 0),
    assignable           boolean       default true              not null,
    eligible_for_award   boolean       default false             not null,
    visible_to_scorers   boolean       default true              not null,
    prosecution          boolean       default false             not null,
    defense              boolean       default false             not null,
    calling              boolean       default false             not null,
    crossing             boolean       default false             not null,
    position             smallint                                not null,
    award_category_id    uuid
        references scoring_template_award_categories (id) on delete set null
);

create index scoring_template_fields_category_id_idx
    on scoring_template_fields (template_category_id);


create table tournaments
(
    id                  uuid      default gen_random_uuid() not null
        primary key,
    name                text                                not null,
    location            text                                not null,
    start_date          date,
    end_date            date,
    created_at          timestamp default now()             not null,
    case_format_id      uuid                                not null
        references tournament_format (format_id),
    num_rounds          smallint  default 0                 not null,
    num_teams           smallint  default 0                 not null,
    standings_config_id uuid
        references standings_configs (id),
    status              text      default 'active'          not null
        constraint tournaments_status_check
            check (status in ('active', 'completed', 'archived')),
    constraint tournaments_check
        check ((start_date IS NULL) OR (end_date IS NULL) OR (start_date <= end_date))
);

create index tournaments_status_idx on tournaments (status);

create table case_witnesses
(
    id          uuid default gen_random_uuid() not null
        primary key,
    case_format uuid                           not null
        references tournament_format (format_id)
            on delete cascade,
    side        varchar(1)                     not null
        constraint case_witnesses_side_check
            check (side in ('P', 'D', 'S')),
    name        text                           not null
);

create index case_witnesses_case_format_idx on case_witnesses (case_format);

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

create table individual_award_categories
(
    id             uuid     default gen_random_uuid() not null
        primary key,
    tournament_id  uuid                               not null
        references tournaments
            on delete cascade,
    name           text                               not null,
    min_nominees   smallint default 1                  not null
        constraint award_categories_min_nominees_check check (min_nominees >= 0),
    max_nominees   smallint default 3                  not null
        constraint award_categories_max_nominees_check check (max_nominees >= 1),
    constraint award_categories_min_max_check check (min_nominees <= max_nominees)
);

create index individual_award_categories_tournament_id_idx on individual_award_categories (tournament_id);

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
            check (multiplier <> 0),
    assignable         boolean       default true              not null,
    visible_to_scorers boolean       default true              not null,
    prosecution        boolean       default false             not null,
    defense            boolean       default false             not null,
    calling            boolean       default false             not null,
    crossing           boolean       default false             not null,
    position           smallint                                not null,
    award_category_id  uuid
        references individual_award_categories (id)
            on delete set null,
    unique (category_id, position),
    constraint scoring_fields_check
        check (min_score <= max_score)
);

create index scoring_fields_category_id_idx on scoring_fields (category_id);

create table tournament_owners
(
    id            uuid default gen_random_uuid() not null
        primary key,
    tournament_id uuid                           not null
        references tournaments
            on delete cascade,
    delegate_id   uuid                           not null
        references auth
            on delete cascade,
    role          text                           not null
        constraint tournament_owners_role_check
            check (role in ('owner', 'delegate')),
    unique (tournament_id, delegate_id)
);

create index tournament_owners_delegate_idx on tournament_owners (delegate_id);

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

create index tournament_delegate_invites_tournament_id_idx on tournament_delegate_invites (tournament_id);

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

create index scorers_tournament_id_idx on scorers (tournament_id);

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

create index teams_tournament_id_idx on teams (tournament_id);

create table team_invites
(
    id           uuid default gen_random_uuid() not null
        primary key,
    team_id      uuid                           not null
        references teams
            on delete cascade,
    invite_email text                           not null
);

create index team_invites_team_id_idx on team_invites (team_id);

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

create index team_coaches_team_id_idx on team_coaches (team_id);

create table rounds
(
    round_id       uuid    default gen_random_uuid() not null
        primary key,
    tournament_id  uuid                              not null
        references tournaments
            on delete cascade,
    results_public boolean default false             not null,
    teams_public   boolean default false             not null,
    name           text                              not null,
    round_time     timestamp with time zone
);

create index rounds_tournament_id_idx on rounds (tournament_id);

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

create index pairings_round_id_idx on pairings (round_id);

create table paper_scorers
(
    scorer_id  uuid default gen_random_uuid() not null
        primary key,
    pairing_id uuid                           not null
        references pairings
            on delete cascade,
    name       text                           not null
);

create index paper_scorers_pairing_id_idx on paper_scorers (pairing_id);

create table scorer_pairing_assignments
(
    assignment_id        uuid    default gen_random_uuid() not null
        primary key,
    registered_scorer_id uuid
        references scorers
            on delete cascade,
    paper_scorer_id      uuid
        references paper_scorers
            on delete cascade,
    pairing_id           uuid                              not null
        references pairings
            on delete cascade,
    conflict_reported    boolean default false             not null,
    constraint scorer_pairing_assignments_check
        check (((registered_scorer_id IS NOT NULL) AND (paper_scorer_id IS NULL)) OR
               ((registered_scorer_id IS NULL) AND (paper_scorer_id IS NOT NULL)))
);

create index scorer_pairing_assignments_pairing_id_idx on scorer_pairing_assignments (pairing_id);

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
    student_id   uuid default gen_random_uuid() not null
        primary key,
    team_id      uuid                           not null
        references teams (id) on delete cascade,
    student_name text                           not null,
    pronouns     text,
    unique (team_id, student_name)
);

create table ballots
(
    ballot_id            uuid default gen_random_uuid() not null
        primary key,
    scorer_assignment_id uuid                           not null
        constraint ballots_scorer_assignment_id_unique
            unique
        references scorer_pairing_assignments (assignment_id),
    tournament_id        uuid
        references tournaments (id),
    pairing_id           uuid
        references pairings (pairing_id),
    ballot_json          jsonb                          not null,
    p_team_id            uuid
        references teams (id),
    d_team_id            uuid
        references teams (id),
    d_points             integer                        not null,
    p_points             integer                        not null,
    tiebreaker           uuid    default '10db69a9-7596-49e8-9591-b48d0cd28c58' not null,
    presider_ballot      boolean default false          not null
);

create index ballots_tournament_id_idx on ballots (tournament_id);
create index ballots_pairing_id_idx    on ballots (pairing_id);

create table nominations
(
    id                 uuid     default gen_random_uuid() not null
        primary key,
    ballot_id          uuid                               not null
        references ballots (ballot_id)
            on delete cascade,
    award_category_id  uuid                               not null
        references individual_award_categories (id)
            on delete cascade,
    student_id         uuid                               not null
        references team_rostered_students (student_id)
            on delete cascade,
    rank               smallint                           not null
        constraint nominations_rank_check check (rank >= 1)
);

create index nominations_ballot_id_idx on nominations (ballot_id);
create index nominations_award_category_id_idx on nominations (award_category_id);
create index nominations_student_id_idx on nominations (student_id);
create unique index nominations_unique_idx on nominations (ballot_id, award_category_id, student_id);

create table email_complaints
(
    complaint_id uuid default gen_random_uuid() not null
        primary key,
    email        text                           not null
);

create table unsubscribed_emails
(
    unsub_id uuid default gen_random_uuid() not null
        primary key,
    email    text                           not null
);

create table bounced_emails
(
    bounce_id uuid default gen_random_uuid() not null
        primary key,
    email     text                           not null,
    type      text                           not null,
    subtype   text
);

create table scorer_conflicts
(
    id        uuid default gen_random_uuid() not null primary key,
    scorer_id uuid                           not null
        references scorers (scorer_id) on delete cascade,
    team_id   uuid                           not null
        references teams (id) on delete cascade,
    unique (scorer_id, team_id)
);

create table witness_call_order
(
    id         uuid primary key default gen_random_uuid(),
    pairing_id uuid     not null references pairings (pairing_id) on delete cascade,
    team_id    uuid     not null references teams (id) on delete cascade,
    witness_id uuid     not null references case_witnesses (id) on delete cascade,
    position   smallint not null,
    unique (pairing_id, team_id, position)
);

create table student_assignments
(
    id         uuid primary key default gen_random_uuid(),
    pairing_id uuid     not null references pairings (pairing_id) on delete cascade,
    team_id    uuid     not null references teams (id) on delete cascade,
    field_id   uuid     not null references scoring_fields (id) on delete cascade,
    witness_id uuid              references case_witnesses (id) on delete cascade,
    student_id uuid     not null,
    constraint student_assignments_pairing_team_field_witness_key
        unique (pairing_id, team_id, field_id, witness_id)
);

create table default_witness_call_order
(
    id         uuid primary key default gen_random_uuid(),
    team_id    uuid     not null references teams (id) on delete cascade,
    witness_id uuid     not null references case_witnesses (id) on delete cascade,
    position   smallint not null,
    unique (team_id, position)
);

create table default_student_assignments
(
    id         uuid primary key default gen_random_uuid(),
    team_id    uuid not null references teams (id) on delete cascade,
    field_id   uuid not null references scoring_fields (id) on delete cascade,
    witness_id uuid          references case_witnesses (id) on delete cascade,
    student_id uuid not null references team_rostered_students (student_id) on delete cascade,
    unique (team_id, field_id, witness_id)
);

create table password_reset_tokens
(
    id         uuid      default gen_random_uuid() not null primary key,
    user_id    uuid                                not null
        constraint password_reset_tokens_user_unique
            unique
        references auth (user_id) on delete cascade,
    token_hash text                                not null,
    expires_at timestamp                           not null,
    created_at timestamp default now()             not null
);

create index password_reset_tokens_hash_idx    on password_reset_tokens (token_hash);
create index password_reset_tokens_expires_idx on password_reset_tokens (expires_at);

create table email_verification_tokens
(
    id         uuid      default gen_random_uuid() not null primary key,
    user_id    uuid                                not null
        references auth (user_id) on delete cascade,
    token_hash text                                not null,
    expires_at timestamp                           not null,
    created_at timestamp default now()             not null
);

create index idx_email_verification_tokens_hash on email_verification_tokens (token_hash);

create table ballot_edit_log
(
    id              uuid      default gen_random_uuid() not null primary key,
    ballot_id       uuid                                not null
        references ballots (ballot_id) on delete cascade,
    editor_email    text                                not null,
    edited_at       timestamp default now()             not null,
    reason          text                                not null,
    before_json     jsonb                               not null,
    after_json      jsonb                               not null,
    p_points_before integer                             not null,
    p_points_after  integer                             not null,
    d_points_before integer                             not null,
    d_points_after  integer                             not null
);

create index ballot_edit_log_ballot_id_idx on ballot_edit_log (ballot_id);


-- ── Triggers ──────────────────────────────────────────────────────────────────

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
    AFTER INSERT OR UPDATE OR DELETE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_tournament_num_teams();

CREATE TRIGGER trg_update_num_rounds
    AFTER INSERT OR UPDATE OR DELETE ON rounds
    FOR EACH ROW EXECUTE FUNCTION update_tournament_num_rounds();


-- ── Seed Data: Standings Templates ────────────────────────────────────────────

do $$
    declare template_id uuid := gen_random_uuid();
    begin
        insert into standings_configs (id, stats_xml, standings_xml) values
            (template_id,
             '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="define_visible_stats" id="vzM]MMQEaOR7m7db9l6i" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_column" id="$fk1`_SySSuoaq8kSptF"> <field name="STAT">Ballots</field> <field name="LABEL"></field> <next> <block type="standings_column" id="E?@ZMyVUQEa_LJ{dn#j_"> <field name="STAT">Combined Strength</field> <field name="LABEL">CS</field> <next> <block type="standings_column" id="_6n5vwQ_,3or*@O,y,kZ"> <field name="STAT">Point Differential</field> <field name="LABEL">PD</field> <next> <block type="standings_column" id="BictXFBp5zO+8*k`]:jn"> <field name="STAT">Opponent Combined Strength</field> <field name="LABEL">OCS</field> </block> </next> </block> </next> </block> </next> </block> </next> </block> <block type="stat_hat" id="ZjQilwOMeM{XlIE1*Ekp" x="0" y="183"> <field name="NAME">Ballots</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="math_arithmetic" id="[?I6dNAS-BIzwZVSii.`"> <field name="OP">ADD</field> <value name="A"> <block type="pairing_field" id="O}-.I=^Pj-[4F},2~NvG"> <field name="FIELD">ballots_won</field> </block> </value> <value name="B"> <block type="math_arithmetic" id="l/`wM;;R6ukr*?w$YfIy"> <field name="OP">MULTIPLY</field> <value name="A"> <block type="pairing_field" id="jQ[E`%pAp/9oM43b[2`."> <field name="FIELD">ballots_tied</field> </block> </value> <value name="B"> <block type="math_number" id=")VN1n05^hzrSl(]CSHAN"> <field name="NUM">0.5</field> </block> </value> </block> </value> </block> </value> </block> <block type="stat_hat" id="Y{?f2%^@O$(xy9*/{*tE" x="0" y="256"> <field name="NAME">Combined Strength</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="opponent_stat" id="Tb1l[z+iV7K:tj*9{j@C"> <field name="NAME">Ballots</field> </block> </value> </block> <block type="stat_hat" id="LxA.$0aBn|QSm.ww{iAB" x="0" y="307"> <field name="NAME">Point Differential</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="math_arithmetic" id="o|#.lEExY*f~TeZu8.#,"> <field name="OP">MINUS</field> <value name="A"> <block type="ballot_field" id="HCH@knK%(.uQT5KZfRYm"> <field name="FIELD">ballot_pf</field> </block> </value> <value name="B"> <block type="ballot_field" id="JHx!ZdYKSA7NeDtpclI_"> <field name="FIELD">ballot_pa</field> </block> </value> </block> </value> </block> <block type="stat_hat" id="/OnTau[d.{!Ow6BgxuJ1" x="0" y="369"> <field name="NAME">Opponent Combined Strength</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="opponent_stat" id="2Xm?K%+os,H;Xtq5C+O)"> <field name="NAME">Combined Strength</field> </block> </value> </block> </xml>',
             '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="tiebreaker_order" id="p3k!?(d`F=m35|M3fRyO" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_tiebreaker" id="61D@YmQo]JQd$1)Ka(nE"> <field name="STAT">Ballots</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id="(HU8.{o6kUrY+M{R-L1X"> <field name="STAT">Combined Strength</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id=",`?jn$5?3UwOqAeH`X(n"> <field name="STAT">Point Differential</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id="u68YCy!fsCavlob%uC$p"> <field name="STAT">Opponent Combined Strength</field> <field name="ORDER">desc</field> </block> </next> </block> </next> </block> </next> </block> </next> </block> </xml>');
        insert into standings_templates (id, label, description, config_id) values
            (gen_random_uuid(), 'AMTA', 'Ballots -> CS -> PD -> OCS', template_id);
    end;
$$;

DO $$
    DECLARE
        v_template   uuid;
        v_attorney   uuid;
        v_witness    uuid;
        v_cat        uuid;
        v_pretrial uuid;
        v_clerk uuid;
        v_bailiff uuid;
    BEGIN
        -- ============================================================
        -- Template: Teach Democracy Default
        -- ============================================================
        INSERT INTO scoring_templates (label, description)
        VALUES ('Teach Democracy Default', 'Standard Teach Democracy scoring format')
        RETURNING id INTO v_template;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Pretrial', 1, 1) RETURNING id INTO v_pretrial;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Attorney', 4, 4) RETURNING id INTO v_attorney;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Witness', 4, 4) RETURNING id INTO v_witness;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Clerk', 0, 1) RETURNING id INTO v_clerk;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Bailiff', 0, 1) RETURNING id INTO v_bailiff;

        -- Pretrial
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Pretrial', false, 0) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, defense, position, award_category_id)
        VALUES (v_cat, 'Pretrial D', 2, true, 0,v_pretrial);
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, award_category_id, prosecution, position)
        VALUES (v_cat, 'Pretrial P', 2, v_pretrial, true, 1);

        -- Opening
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Opening', false, 1) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Opening', true, true, v_attorney, 0);

        -- Witnesses
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Witnesses', true, 2) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Atty Direct', true, v_attorney, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, crossing, award_category_id, position)
        VALUES (v_cat, 'Atty Cross', true, v_attorney, 1);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness', true, v_witness, 2);

        -- Closing
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Closing', false, 3) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Closing', 2, true, true, v_attorney, 0);

        -- Clerk / Bailiff
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Clerk / Bailiff', false, 4) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, prosecution, position)
        VALUES (v_cat, 'Clerk', 5, v_clerk, true, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, defense, position)
        VALUES (v_cat, 'Bailiff', 5, v_bailiff, true, 1);

        -- Team Score
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Team Score', false, 5) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, assignable, prosecution, defense, position)
        VALUES (v_cat, 'Team Score', false, true, true, 0);

        -- Point Deductions
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Point Deductions', false, 6) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, min_score, max_score, multiplier, assignable, eligible_for_award, prosecution, defense, position)
        VALUES (v_cat, 'Deductions', 0, 100, -1, false, false, true, true, 0);

        -- ============================================================
        -- Template: SLO County
        -- ============================================================
        INSERT INTO scoring_templates (label, description)
        VALUES ('SLO County', 'SLO County scoring format')
        RETURNING id INTO v_template;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Pretrial', 0, 2) RETURNING id INTO v_pretrial;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Attorney', 0, 8) RETURNING id INTO v_attorney;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Witness', 0, 8) RETURNING id INTO v_witness;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Clerk', 0, 1) RETURNING id INTO v_clerk;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Bailiff', 0, 1) RETURNING id INTO v_bailiff;

        -- Pretrial
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Pretrial', false, 0) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, defense, position, award_category_id)
        VALUES (v_cat, 'Pretrial D', 2, true, 0,v_pretrial);
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, award_category_id, prosecution, position)
        VALUES (v_cat, 'Pretrial P', 2, v_pretrial, true, 1);

        -- Opening
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Opening', false, 1) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Opening', true, true, v_attorney, 0);

        -- Witnesses
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Witnesses', true, 2) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Atty Direct', true, v_attorney, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, crossing, award_category_id, position)
        VALUES (v_cat, 'Atty Cross', true, v_attorney, 1);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness', true, v_witness, 2);

        -- Closing
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Closing', false, 3) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Closing', 2, true, true, v_attorney, 0);

        -- Clerk / Bailiff
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Clerk / Bailiff', false, 4) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, prosecution, position)
        VALUES (v_cat, 'Clerk', 10, v_clerk, true, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, max_score, award_category_id, defense, position)
        VALUES (v_cat, 'Bailiff', 10, v_bailiff, true, 1);

        -- Team Score
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Team Score', false, 5) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, assignable, prosecution, defense, position)
        VALUES (v_cat, 'Team Score', false, true, true, 0);

        -- Point Deductions
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Point Deductions', false, 6) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, min_score, max_score, multiplier, assignable, prosecution, defense, position)
        VALUES (v_cat, 'Deductions', 0, 100, -1, false, true, true, 0);


        -- ============================================================
        -- Template: AMTA
        -- ============================================================
        INSERT INTO scoring_templates (label, description)
        VALUES ('AMTA Regular', 'College Mock Trial Format. 3 Attorneys + 3 Witnesses.')
        RETURNING id INTO v_template;


        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Attorney', 4, 4) RETURNING id INTO v_attorney;

        INSERT INTO scoring_template_award_categories (template_id, name, min_nominees, max_nominees)
        VALUES (v_template, 'Outstanding Witness', 4, 4) RETURNING id INTO v_witness;

        -- Opening
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Opening', false, 0) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Opening', true, true, v_attorney, 0);

        -- Witnesses
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Witnesses', true, 1) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Atty Direct', true, v_attorney, 0);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness Direct', true, v_witness, 1);
        INSERT INTO scoring_template_fields (template_category_id, label, crossing, award_category_id, position)
        VALUES (v_cat, 'Atty Cross', true, v_attorney, 2);
        INSERT INTO scoring_template_fields (template_category_id, label, calling, award_category_id, position)
        VALUES (v_cat, 'Witness Cross', true, v_witness, 3);


        -- Closing
        INSERT INTO scoring_template_categories (template_id, name, witness_category, position)
        VALUES (v_template, 'Closing', false, 2) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, multiplier, prosecution, defense, award_category_id, position)
        VALUES (v_cat, 'Closing', 1, true, true, v_attorney, 0);

        -- Point Deductions
        INSERT INTO scoring_template_categories (template_id, name, witness_category,  position)
        VALUES (v_template, 'Point Deductions', false, 6) RETURNING id INTO v_cat;
        INSERT INTO scoring_template_fields (template_category_id, label, min_score, max_score, multiplier, assignable, prosecution, defense, position, visible_to_scorers)
        VALUES (v_cat, 'Deductions', 0, 100, -1, false, true, true, 0, false);
    END $$;
