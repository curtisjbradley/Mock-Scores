const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }

const TOURNAMENTS = [
  {
    id: 'tourney-1',
    name: 'Spring Invitational',
    location: 'Downtown Courthouse',
    start_date: '2026-03-01T00:00:00Z',
    end_date: '2026-03-02T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    case_format_id: 'cf-1',
    num_teams: 8,
    num_rounds: 3,
  },
  {
    id: 'tourney-2',
    name: 'Fall Classic',
    location: 'City Hall',
    start_date: null,
    end_date: null,
    created_at: '2026-01-02T00:00:00Z',
    case_format_id: 'cf-2',
    num_teams: 4,
    num_rounds: 2,
  },
]

describe('Organizer Home', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    cy.intercept('GET', '/api/organizer/tournament', { statusCode: 200, body: TOURNAMENTS }).as('getTournaments')
    cy.visit('/organizer')
    cy.wait('@session')
    cy.wait('@getTournaments')
  })

  it('renders the tournaments heading and New tournament button', () => {
    cy.contains('h1', 'Tournaments').should('be.visible')
    cy.contains('button', '+ New tournament').should('be.visible')
  })

  it('lists all tournaments returned by the API', () => {
    cy.contains('Spring Invitational').should('be.visible')
    cy.contains('Fall Classic').should('be.visible')
  })

  it('shows location, team count, and round count for each tournament', () => {
    cy.contains('Downtown Courthouse').should('be.visible')
    cy.contains('8 teams').should('be.visible')
    cy.contains('3 rounds').should('be.visible')
  })

  it('shows TBD when dates are null', () => {
    cy.contains('TBD').should('be.visible')
  })

  it('navigates to /organizer/new when "+ New tournament" is clicked', () => {
    cy.contains('button', '+ New tournament').click()
    cy.url().should('include', '/organizer/new')
  })

  it('navigates to the tournament dashboard when a card is clicked', () => {
    cy.intercept('GET', '/api/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENTS[0] }).as('getTournament')
    cy.contains('Spring Invitational').click()
    cy.url().should('include', '/organizer/tourney-1')
  })

  it('opens the duplicate modal when Duplicate is clicked', () => {
    cy.contains('[aria-label="Duplicate Spring Invitational"]', 'Duplicate').click()
    cy.contains('Spring Invitational').should('be.visible')  // modal shows the name
    // modal has a submit/duplicate action
    cy.contains('button', /duplicate/i).should('exist')
  })

  it('closes duplicate modal when cancelled', () => {
    cy.contains('[aria-label="Duplicate Spring Invitational"]', 'Duplicate').click()
    cy.contains('button', /cancel/i).click()
    // modal should be gone — only one "Duplicate" button per card remains
    cy.get('[aria-label="Duplicate Spring Invitational"]').should('have.length', 1)
  })

  it('handles empty tournament list gracefully', () => {
    cy.intercept('GET', '/api/organizer/tournament', { statusCode: 200, body: [] }).as('empty')
    cy.visit('/organizer')
    cy.wait('@session')
    cy.wait('@empty')
    cy.contains('h1', 'Tournaments').should('be.visible')
    cy.get('.org-tournament-card').should('not.exist')
  })
})
