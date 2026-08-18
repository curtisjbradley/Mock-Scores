const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }

const ROUND = { round_id: 'round-1', tournament_id: 'tourney-1', name: 'Round 1', round_time: null }

const TEAMS = [
  { id: 'team-1', code: 'A1', name: 'Eagles', tournament_id: 'tourney-1' },
  { id: 'team-2', code: 'B2', name: 'Hawks', tournament_id: 'tourney-1' },
]

const COURTROOMS = [
  { id: 'cr-1', name: 'Courtroom A', location: 'Floor 1', tournament_id: 'tourney-1' },
]

const PAIRINGS = [
  { pairing_id: 'pair-1', round_id: 'round-1', p_team: 'team-1', d_team: 'team-2', courtroom_id: 'cr-1', pg_public: false, results_public: false },
]

function stubRoundView(pairings = PAIRINGS) {
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/round-1', { statusCode: 200, body: ROUND }).as('getRound')
  cy.intercept('GET', '/organizer/tournament/tourney-1/teams', { statusCode: 200, body: TEAMS }).as('getTeams')
  cy.intercept('GET', '/organizer/tournament/tourney-1/courtrooms', { statusCode: 200, body: COURTROOMS }).as('getCourtrooms')
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/round-1/pairings', { statusCode: 200, body: pairings }).as('getPairings')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scorers', { statusCode: 200, body: [] }).as('getScorers')
  cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/round-1/pairings/pair-1/scorers', { statusCode: 200, body: [] }).as('getPairingScorers')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scorer-conflicts', { statusCode: 200, body: [] }).as('getConflicts')
}

describe('Round View', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubRoundView()
    cy.visit('/organizer/tourney-1/round/round-1')
    cy.wait('@session')
    cy.wait('@getRound')
    cy.wait('@getPairings')
  })

  it('renders the round name', () => {
    cy.contains('Round 1').should('be.visible')
  })

  it('back button navigates to rounds tab', () => {
    cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: { id: 'tourney-1', name: 'Spring Invitational', location: '', num_teams: 0, num_rounds: 0, case_format_id: 'cf-1' } }).as('getTournament')
    cy.contains('button', '← Back to rounds').click()
    cy.url().should('include', '/organizer/tourney-1')
    cy.url().should('include', 'page=rounds')
  })

  it('shows existing pairings', () => {
    cy.contains('Eagles').should('be.visible')
    cy.contains('Hawks').should('be.visible')
  })

  it('shows empty state when no pairings', () => {
    stubRoundView([])
    cy.visit('/organizer/tourney-1/round/round-1')
    cy.wait('@session')
    cy.wait('@getRound')
    cy.wait('@getPairings')
    cy.contains('No matchups yet').should('be.visible')
  })

  it('shows add matchup form when "+ Add matchup" is clicked', () => {
    cy.contains('button', '+ Add matchup').click()
    cy.contains('New matchup').should('be.visible')
    cy.contains('Prosecution').should('be.visible')
    cy.contains('Defense').should('be.visible')
    cy.contains('Courtroom').should('be.visible')
  })

  it('hides add form when Cancel is clicked', () => {
    cy.contains('button', '+ Add matchup').click()
    cy.contains('button', 'Cancel').click()
    cy.contains('New matchup').should('not.exist')
  })

  it('shows validation errors when submitting empty add form', () => {
    cy.contains('button', '+ Add matchup').click()
    cy.contains('button', 'Add matchup').click()
    cy.contains('Select prosecution team').should('be.visible')
    cy.contains('Select defense team').should('be.visible')
    cy.contains('Select a courtroom').should('be.visible')
  })

  it('shows 404 page when round is not found', () => {
    cy.intercept('GET', '/organizer/tournament/tourney-1/rounds/round-1', { statusCode: 404, body: {} }).as('notFound')
    cy.visit('/organizer/tourney-1/round/round-1')
    cy.wait('@session')
    cy.wait('@notFound')
    cy.contains(/not found/i).should('be.visible')
  })

  it('can inline-edit the round name', () => {
    cy.intercept('PATCH', '/organizer/tournament/tourney-1/rounds/round-1', { statusCode: 200, body: {} }).as('patchRound')
    cy.contains('Round 1').click()
    cy.get('input.rv-name-input').clear().type('Round One{enter}')
    cy.contains('Round One').should('be.visible')
  })
})
