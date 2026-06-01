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
    description text                           not null default '',
    config_id   uuid                           not null references standings_configs (id) on delete cascade
);

create table tournaments
(
    id                  uuid      default gen_random_uuid() not null
        primary key,
    name                text                                not null,
    location            text                                not null,
    start_date          date,
    end_date            date,
    created_at          timestamp default now()             not null,
    case_format_id      uuid                                not null references tournament_format (format_id),
    num_rounds          smallint  default 0                 not null,
    num_teams           smallint  default 0                 not null,
    standings_config_id uuid not null references standings_configs (id),
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
    invite_email text                           not null
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
    name           text    not null,
    round_time     timestamp with time zone
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

create table ballots (
    score_id uuid primary key default gen_random_uuid(),
    scorer_assignment_id uuid references scorer_pairing_assignments(assignment_id) not null,
    tournament_id uuid references tournaments(id),
    ballot_json jsonb not null,
    p_team_id uuid references teams(id),
    d_team_id uuid references teams(id),
    d_points int not null,
    p_points int not null
);


create table email_complaints (
    complaint_id uuid primary key default gen_random_uuid(),
    email text not null
);

create table unsubscribed_emails (
    unsub_id uuid primary key default gen_random_uuid(),
    email text not null
);

create table bounced_emails (
     bounce_id uuid primary key default gen_random_uuid(),
     email text not null,
     type text not null,
    subtype text
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


-- Define AMTA standings template --
do $$
    declare  template_id uuid  := gen_random_uuid();
    begin
        insert into standings_configs (id, stats_xml, standings_xml) VALUES
            (template_id, '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="define_visible_stats" id="vzM]MMQEaOR7m7db9l6i" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_column" id="$fk1`_SySSuoaq8kSptF"> <field name="STAT">Ballots</field> <field name="LABEL"></field> <next> <block type="standings_column" id="E?@ZMyVUQEa_LJ{dn#j_"> <field name="STAT">Combined Strength</field> <field name="LABEL">CS</field> <next> <block type="standings_column" id="_6n5vwQ_,3or*@O,y,kZ"> <field name="STAT">Point Differential</field> <field name="LABEL">PD</field> <next> <block type="standings_column" id="BictXFBp5zO+8*k`]:jn"> <field name="STAT">Opponent Combined Strength</field> <field name="LABEL">OCS</field> </block> </next> </block> </next> </block> </next> </block> </next> </block> <block type="stat_hat" id="ZjQilwOMeM{XlIE1*Ekp" x="0" y="183"> <field name="NAME">Ballots</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="math_arithmetic" id="[?I6dNAS-BIzwZVSii.`"> <field name="OP">ADD</field> <value name="A"> <block type="pairing_field" id="O}-.I=^Pj-[4F},2~NvG"> <field name="FIELD">ballots_won</field> </block> </value> <value name="B"> <block type="math_arithmetic" id="l/`wM;;R6ukr*?w$YfIy"> <field name="OP">MULTIPLY</field> <value name="A"> <block type="pairing_field" id="jQ[E`%pAp/9oM43b[2`."> <field name="FIELD">ballots_tied</field> </block> </value> <value name="B"> <block type="math_number" id=")VN1n05^hzrSl(]CSHAN"> <field name="NUM">0.5</field> </block> </value> </block> </value> </block> </value> </block> <block type="stat_hat" id="Y{?f2%^@O$(xy9*/{*tE" x="0" y="256"> <field name="NAME">Combined Strength</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="opponent_stat" id="Tb1l[z+iV7K:tj*9{j@C"> <field name="NAME">Ballots</field> </block> </value> </block> <block type="stat_hat" id="LxA.$0aBn|QSm.ww{iAB" x="0" y="307"> <field name="NAME">Point Differential</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="math_arithmetic" id="o|#.lEExY*f~TeZu8.#,"> <field name="OP">MINUS</field> <value name="A"> <block type="ballot_field" id="HCH@knK%(.uQT5KZfRYm"> <field name="FIELD">ballot_pf</field> </block> </value> <value name="B"> <block type="ballot_field" id="JHx!ZdYKSA7NeDtpclI_"> <field name="FIELD">ballot_pa</field> </block> </value> </block> </value> </block> <block type="stat_hat" id="/OnTau[d.{!Ow6BgxuJ1" x="0" y="369"> <field name="NAME">Opponent Combined Strength</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="opponent_stat" id="2Xm?K%+os,H;Xtq5C+O)"> <field name="NAME">Combined Strength</field> </block> </value> </block> </xml>',
             '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="tiebreaker_order" id="p3k!?(d`F=m35|M3fRyO" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_tiebreaker" id="61D@YmQo]JQd$1)Ka(nE"> <field name="STAT">Ballots</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id="(HU8.{o6kUrY+M{R-L1X"> <field name="STAT">Combined Strength</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id=",`?jn$5?3UwOqAeH`X(n"> <field name="STAT">Point Differential</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id="u68YCy!fsCavlob%uC$p"> <field name="STAT">Opponent Combined Strength</field> <field name="ORDER">desc</field> </block> </next> </block> </next> </block> </next> </block> </next> </block> </xml>');
        insert into standings_templates (id, label, description, config_id) VALUES
            (gen_random_uuid(), 'AMTA', 'Ballots -> CS -> PD -> OCS', template_id);
    end;
$$;



--- Define SLO County standings Template ---
do $$
    declare  template_id uuid  := gen_random_uuid();
    begin
        insert into standings_configs (id, stats_xml, standings_xml) VALUES
            (template_id, '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="define_visible_stats" id="vzM]MMQEaOR7m7db9l6i" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_column" id="`lc^0/UCl9$l)TgaxA,r"> <field name="STAT">Wins</field> <field name="LABEL"></field> <next> <block type="standings_column" id="h0q-=4*]3:K.aIgP9@/4"> <field name="STAT">Cumulative % Points</field> <field name="LABEL"></field> </block> </next> </block> </next> </block> <block type="stat_hat" id="]fik0@H.Mc@8SVM4=0vB" x="0" y="129"> <field name="NAME">Wins</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="intermediate_ref" id="RG_R7ZFiRP?.!{n79Z#["> <field name="NAME">Win</field> </block> </value> </block> <block type="intermediate_stat_hat" id="J4k#p$A_-JI7iuZeT.+2" x="0" y="180"> <field name="NAME">Win</field> <value name="VALUE"> <block type="logic_ternary" id="}@!l{4CYz6iaXV28FvNH"> <value name="IF"> <block type="logic_compare" id="/+.BaLl=`X@Rl5+CMmB|"> <field name="OP">EQ</field> <value name="A"> <block type="pairing_field" id="dZn;Ep+]/n:-BA/}f,56"> <field name="FIELD">points_for</field> </block> </value> <value name="B"> <block type="pairing_field" id="*?0x{$k+:tN={Hh/0+o{"> <field name="FIELD">points_against</field> </block> </value> </block> </value> <value name="THEN"> <block type="pairing_field" id="w{B~+BH@,?^NibJ5_4Mj"> <field name="FIELD">won_presider_tb</field> </block> </value> <value name="ELSE"> <block type="logic_ternary" id="qyn5/%]aeKLto6xM)?HF"> <value name="IF"> <block type="logic_compare" id="b?#RDVj2J!hGhRBJjIiS"> <field name="OP">GT</field> <value name="A"> <block type="pairing_field" id=":gnP=@qBO]xretE5tP(p"> <field name="FIELD">points_for</field> </block> </value> <value name="B"> <block type="pairing_field" id="nLSc6-0l)YcEp]vVE/kf"> <field name="FIELD">points_against</field> </block> </value> </block> </value> <value name="THEN"> <block type="math_number" id="wkB!+mi4U`=NYDi$l.}3"> <field name="NUM">1</field> </block> </value> <value name="ELSE"> <block type="math_number" id="|(.Ss3FLI?J=I$LTr[W+"> <field name="NUM">0</field> </block> </value> </block> </value> </block> </value> </block> <block type="stat_hat" id="j@~-G{z]Bk4XT#Z9/4[B" x="0" y="361"> <field name="NAME">Cumulative % Points</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="math_arithmetic" id="r%qM6|%cl)V`5H3KbfRo"> <field name="OP">DIVIDE</field> <value name="A"> <block type="pairing_field" id="uH,b3}oE8E3)JsYK.u.{"> <field name="FIELD">points_for</field> </block> </value> <value name="B"> <block type="math_arithmetic" id="m.;V%g6b-n_HZsE_rMg="> <field name="OP">ADD</field> <value name="A"> <block type="pairing_field" id="Xe{txetEv#-xMiDJyT_%"> <field name="FIELD">points_for</field> </block> </value> <value name="B"> <block type="pairing_field" id="8%=B[@gB*8V#O9rV}{Rj">',
             '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="tiebreaker_order" id="p3k!?(d`F=m35|M3fRyO" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_tiebreaker" id="scGao|sAvD/hZc,f7q}S"> <field name="STAT">Wins</field> <field name="ORDER">desc</field> <next> <block type="standings_h2h_conditional" id="//DXc^]K3n)+V8c00}#X"> <field name="STAT">Win</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id="a@B9Hqr8Yt!UY_8t[%0W"> <field name="STAT">Cumulative % Points</field> <field name="ORDER">desc</field> </block> </next> </block> </next> </block> </next> </block> </xml>');
        insert into standings_templates (id, label, description, config_id) VALUES
            (gen_random_uuid(), 'SLO County', 'Wins (Raw Points -> Presider Tiebreak) -> Head to Head -> Cumulative % Points ', template_id);
    end;
$$;