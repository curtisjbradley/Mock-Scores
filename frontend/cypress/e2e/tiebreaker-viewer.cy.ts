const USER = { userId: '2', email: 'coach@example.com', firstName: 'Bob', lastName: 'Coach' }

const TOURNAMENT = {
  id: 't-1', name: 'Spring Invitational', location: 'Courthouse',
  start_date: null, end_date: null, num_teams: 2, num_rounds: 1,
  team_id: 'team-1', team_name: 'Lincoln High', team_code: '101',
}

// Real DSL from documentation/TableSetup.sql default AMTA template
const AMTA_DSL = `(config
  (stat "Ballots" sum (+ (pairing ballots_won) (* (pairing ballots_tied) 0.5)))
  (stat "Combined Strength" sum (opponent "Ballots"))
  (stat "Point Differential" sum (- (pairing ballot_pf) (pairing ballot_pa)))
  (stat "Opponent Combined Strength" sum (opponent "Combined Strength"))
  (columns (column "Ballots" "Ballots") (column "Combined Strength" "CS") (column "Point Differential" "PD") (column "Opponent Combined Strength" "OCS"))
  (tiebreakers (by "Ballots" desc) (by "Combined Strength" desc) (by "Point Differential" desc) (by "Opponent Combined Strength" desc)))`

// Two teams with one completed pairing so standings rows are non-empty (required for viewer to render)
const STANDINGS_RESPONSE = {
  config: { dsl: AMTA_DSL },
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
  it('shows "No tiebreakers configured" when the DSL has no rules', () => {
    const emptyDsl = '(config (columns) (tiebreakers))'
    cy.loginAs(USER)
    cy.intercept('GET', '/coach/tournaments', { statusCode: 200, body: [TOURNAMENT] }).as('getTournaments')
    cy.intercept('GET', '/coach/tournaments/t-1/schedule', { statusCode: 200, body: [] }).as('getSchedule')
    cy.intercept('GET', '/coach/tournaments/t-1/results', { statusCode: 200, body: [] }).as('getResults')
    cy.intercept('GET', '/coach/tournaments/t-1/standings', {
      statusCode: 200,
      body: { ...STANDINGS_RESPONSE, config: { dsl: emptyDsl } },
    }).as('getStandings')
    cy.visit('/coach/t-1?page=standings')
    cy.wait('@session')
    cy.wait('@getTournaments')
    cy.wait('@getStandings')
    cy.contains('No tiebreakers configured').should('be.visible')
  })
})
