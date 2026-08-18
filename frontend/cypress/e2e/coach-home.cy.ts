const USER = { userId: '2', email: 'coach@example.com', firstName: 'Bob', lastName: 'Coach' }

const TOURNAMENTS = [
  {
    id: 't-1',
    name: 'Spring Invitational',
    location: 'Courthouse',
    start_date: '2026-03-01T00:00:00Z',
    end_date: '2026-03-02T00:00:00Z',
    num_teams: 8,
    num_rounds: 3,
    team_id: 'team-1',
    team_name: 'Lincoln High',
    team_code: '101',
  },
]

describe('Coach Home', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    cy.intercept('GET', '/coach/tournaments', { statusCode: 200, body: TOURNAMENTS }).as('getTournaments')
    cy.visit('/coach')
    cy.wait('@session')
    cy.wait('@getTournaments')
  })

  it('renders the select a tournament heading', () => {
    cy.contains('h1', 'Select a tournament').should('be.visible')
  })

  it('shows tournament cards', () => {
    cy.contains('Lincoln High - Spring Invitational').should('be.visible')
    cy.contains('101').should('be.visible')
    cy.contains('Courthouse').should('be.visible')
  })

  it('navigates to the coach dashboard on card click', () => {
    cy.intercept('GET', '/coach/tournaments', { statusCode: 200, body: TOURNAMENTS }).as('ts2')
    cy.intercept('GET', '/coach/tournaments/t-1/schedule', { statusCode: 200, body: [] }).as('schedule')
    cy.intercept('GET', '/coach/tournaments/t-1/results', { statusCode: 200, body: [] }).as('results')
    cy.contains('Lincoln High - Spring Invitational').click()
    cy.url().should('include', '/coach/t-1')
  })

  it('shows empty state when no tournaments', () => {
    cy.intercept('GET', '/coach/tournaments', { statusCode: 200, body: [] }).as('empty')
    cy.visit('/coach')
    cy.wait('@session')
    cy.wait('@empty')
    cy.contains('No tournaments found.').should('be.visible')
  })
})
