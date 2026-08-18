const USER = { userId: '2', email: 'coach@example.com', firstName: 'Bob', lastName: 'Coach' }

const TOURNAMENT = {
  id: 't-1', name: 'Spring Invitational', location: 'Courthouse',
  start_date: null, end_date: null, num_teams: 2, num_rounds: 1,
  team_id: 'team-1', team_name: 'Lincoln High', team_code: '101',
}

// Real XML from documentation/TableSetup.sql default AMTA template
const STANDINGS_XML = '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="tiebreaker_order" id="p3k!?(d`F=m35|M3fRyO" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_tiebreaker" id="61D@YmQo]JQd$1)Ka(nE"> <field name="STAT">Ballots</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id="(HU8.{o6kUrY+M{R-L1X"> <field name="STAT">Combined Strength</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id=",`?jn$5?3UwOqAeH`X(n"> <field name="STAT">Point Differential</field> <field name="ORDER">desc</field> <next> <block type="standings_tiebreaker" id="u68YCy!fsCavlob%uC$p"> <field name="STAT">Opponent Combined Strength</field> <field name="ORDER">desc</field> </block> </next> </block> </next> </block> </next> </block> </next> </block> </xml>'

const STATS_XML = '<xml xmlns="https://developers.google.com/blockly/xml"> <block type="define_visible_stats" id="vzM]MMQEaOR7m7db9l6i" deletable="false" movable="false" x="20" y="20"> <next> <block type="standings_column" id="$fk1`_SySSuoaq8kSptF"> <field name="STAT">Ballots</field> <field name="LABEL"></field> <next> <block type="standings_column" id="E?@ZMyVUQEa_LJ{dn#j_"> <field name="STAT">Combined Strength</field> <field name="LABEL">CS</field> <next> <block type="standings_column" id="_6n5vwQ_,3or*@O,y,kZ"> <field name="STAT">Point Differential</field> <field name="LABEL">PD</field> <next> <block type="standings_column" id="BictXFBp5zO+8*k`]:jn"> <field name="STAT">Opponent Combined Strength</field> <field name="LABEL">OCS</field> </block> </next> </block> </next> </block> </next> </block> </next> </block> <block type="stat_hat" id="ZjQilwOMeM{XlIE1*Ekp" x="0" y="183"> <field name="NAME">Ballots</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="math_arithmetic" id="[?I6dNAS-BIzwZVSii.`"> <field name="OP">ADD</field> <value name="A"> <block type="pairing_field" id="O}-.I=^Pj-[4F},2~NvG"> <field name="FIELD">ballots_won</field> </block> </value> <value name="B"> <block type="math_arithmetic" id="l/`wM;;R6ukr*?w$YfIy"> <field name="OP">MULTIPLY</field> <value name="A"> <block type="pairing_field" id="jQ[E`%pAp/9oM43b[2`."> <field name="FIELD">ballots_tied</field> </block> </value> <value name="B"> <block type="math_number" id=")VN1n05^hzrSl(]CSHAN"> <field name="NUM">0.5</field> </block> </value> </block> </value> </block> </value> </block> <block type="stat_hat" id="Y{?f2%^@O$(xy9*/{*tE" x="0" y="256"> <field name="NAME">Combined Strength</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="opponent_stat" id="Tb1l[z+iV7K:tj*9{j@C"> <field name="NAME">Ballots</field> </block> </value> </block> <block type="stat_hat" id="LxA.$0aBn|QSm.ww{iAB" x="0" y="307"> <field name="NAME">Point Differential</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="math_arithmetic" id="o|#.lEExY*f~TeZu8.#,"> <field name="OP">MINUS</field> <value name="A"> <block type="ballot_field" id="HCH@knK%(.uQT5KZfRYm"> <field name="FIELD">ballot_pf</field> </block> </value> <value name="B"> <block type="ballot_field" id="JHx!ZdYKSA7NeDtpclI_"> <field name="FIELD">ballot_pa</field> </block> </value> </block> </value> </block> <block type="stat_hat" id="/OnTau[d.{!Ow6BgxuJ1" x="0" y="369"> <field name="NAME">Opponent Combined Strength</field> <field name="AGG">sum</field> <value name="VALUE"> <block type="opponent_stat" id="2Xm?K%+os,H;Xtq5C+O)"> <field name="NAME">Combined Strength</field> </block> </value> </block> </xml>'

// Two teams with one completed pairing so standings rows are non-empty (required for viewer to render)
const STANDINGS_RESPONSE = {
  config: { statsXml: STATS_XML, standingsXml: STANDINGS_XML },
  teams: [
    { id: 'team-1', name: 'Lincoln High', code: '101' },
    { id: 'team-2', name: 'Jefferson High', code: '102' },
  ],
  ballots: [
    { pairing_id: 'p-1', p_team_id: 'team-1', d_team_id: 'team-2', p_points: 140, d_points: 120 },
  ],
}

function stubForStandings() {
  cy.intercept('GET', '/coach/tournaments', { statusCode: 200, body: [TOURNAMENT] }).as('getTournaments')
  cy.intercept('GET', '/coach/tournaments/t-1/schedule', { statusCode: 200, body: [] }).as('getSchedule')
  cy.intercept('GET', '/coach/tournaments/t-1/results', { statusCode: 200, body: [] }).as('getResults')
  cy.intercept('GET', '/coach/tournaments/t-1/standings', { statusCode: 200, body: STANDINGS_RESPONSE }).as('getStandings')
}

describe('TiebreakerViewer — via Coach Standings tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubForStandings()
    cy.visit('/coach/t-1?page=standings')
    cy.wait('@session')
    cy.wait('@getTournaments')
    cy.wait('@getStandings')
  })

  it('renders the Tiebreakers heading', () => {
    cy.contains('Tiebreakers').should('be.visible')
  })

  it('renders all 4 tiebreaker rules from the AMTA template', () => {
    cy.contains('Break ties by').should('be.visible')
    cy.contains('Ballots').should('be.visible')
    cy.contains('Combined Strength').should('be.visible')
    cy.contains('Point Differential').should('be.visible')
    cy.contains('Opponent Combined Strength').should('be.visible')
  })

  it('shows "highest first" for desc-ordered rules', () => {
    cy.contains('highest first').should('be.visible')
  })

  it('renders exactly 4 tiebreaker list items', () => {
    cy.get('ol li').should('have.length', 4)
  })
})

describe('TiebreakerViewer — no tiebreakers configured', () => {
  it('shows "No tiebreakers configured" when standingsXml has no rules', () => {
    const emptyStandingsXml = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="tiebreaker_order" deletable="false" movable="false" x="20" y="20"></block></xml>'
    cy.loginAs(USER)
    cy.intercept('GET', '/coach/tournaments', { statusCode: 200, body: [TOURNAMENT] }).as('getTournaments')
    cy.intercept('GET', '/coach/tournaments/t-1/schedule', { statusCode: 200, body: [] }).as('getSchedule')
    cy.intercept('GET', '/coach/tournaments/t-1/results', { statusCode: 200, body: [] }).as('getResults')
    cy.intercept('GET', '/coach/tournaments/t-1/standings', {
      statusCode: 200,
      body: { ...STANDINGS_RESPONSE, config: { ...STANDINGS_RESPONSE.config, standingsXml: emptyStandingsXml } },
    }).as('getStandings')
    cy.visit('/coach/t-1?page=standings')
    cy.wait('@session')
    cy.wait('@getTournaments')
    cy.wait('@getStandings')
    cy.contains('No tiebreakers configured').should('be.visible')
  })
})
