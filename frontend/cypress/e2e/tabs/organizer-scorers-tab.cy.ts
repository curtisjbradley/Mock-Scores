const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const SCORERS = [
  { scorer_id: 's-1', name: 'Jane Doe', email: 'jane@example.com', is_paper: false, willing_to_preside: true, notes: '', prefers_to_score_with: [] },
  { scorer_id: 's-2', name: 'Bob Smith', email: 'bob@example.com', is_paper: false, willing_to_preside: true, notes: '', prefers_to_score_with: [] },
]

function stubScorersTab() {
  cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scorers', { statusCode: 200, body: SCORERS }).as('getScorers')
}

describe('Scorers Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubScorersTab()
    cy.visit('/organizer/tourney-1?page=scorers')
    cy.wait('@session')
    cy.wait('@getTournament')
    cy.wait('@getScorers')
  })

  it('renders the scorers table', () => {
    cy.contains('Jane Doe').should('be.visible')
    cy.contains('Bob Smith').should('be.visible')
    cy.contains('jane@example.com').should('be.visible')
  })

  it('opens Add scorer modal', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('#scorer-name').should('exist')
    cy.get('#scorer-email').should('exist')
  })

  it('submit button disabled when form is empty', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Add scorer').should('be.disabled')
    })
    cy.contains('button', 'Cancel').click()
  })

  it('shows invalid email error', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.get('#scorer-email').type('not-an-email')
    cy.contains('Invalid email address').should('be.visible')
  })

  it('closes modal on cancel', () => {
    cy.contains('button', '+ Add scorer').click()
    cy.contains('button', 'Cancel').click()
    cy.get('[role="dialog"]').should('not.exist')
  })

  it('opens the scorer management page', () => {
    cy.intercept('GET', '/organizer/tournament/tourney-1/scorers/s-1', { statusCode: 200, body: { scorer: SCORERS[0], scorers: SCORERS, assignments: [], conflicts: [], teams: [] } }).as('getScorer')
    cy.contains('tr', 'Jane Doe').contains('a', 'Manage Scorer').click()
    cy.wait('@getScorer')
    cy.contains('h1', 'Jane Doe').should('be.visible')
    cy.contains('h2', 'Round assignments').should('be.visible')
    cy.contains('h2', 'Scorer details').parent().contains('button', 'Edit').click()
    cy.get('#scorer-view-name').should('have.value', 'Jane Doe')
    cy.contains('button', 'Save').should('be.visible')
    cy.contains('button', 'Cancel').should('be.visible')
    cy.contains('button', 'Manage conflicts').should('be.visible')
  })
})
