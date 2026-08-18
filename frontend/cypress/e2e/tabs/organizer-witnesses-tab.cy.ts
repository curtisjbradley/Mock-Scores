const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const WITNESSES = { pWitnessNames: ['Alice', 'Bob'], dWitnessNames: ['Carol'], swingWitnessNames: [] }
const FORMAT = { case_name: 'People v. Test', criminal_case: true, p_witnesses_called: 2, d_witnesses_called: 1, has_swing: false }

function stubWitnessesTab() {
  cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/organizer/tournament/tourney-1/witnesses', { statusCode: 200, body: WITNESSES }).as('getWitnesses')
  cy.intercept('GET', '/organizer/tournament/tourney-1/format', { statusCode: 200, body: FORMAT }).as('getFormat')
}

describe('Witnesses Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubWitnessesTab()
    cy.visit('/organizer/tourney-1?page=witnesses')
    cy.wait('@session')
    cy.wait('@getTournament')
  })

  it('renders existing witness names', () => {
    cy.get('.tc-section').first().find('input[type="text"]').first().should('have.value', 'Alice')
    cy.get('.tc-section').first().find('input[type="text"]').eq(1).should('have.value', 'Bob')
  })

  it('renders P and D section labels', () => {
    cy.contains('P witnesses').should('be.visible')
    cy.contains('D witnesses').should('be.visible')
  })

  it('renders Save button', () => {
    cy.contains('button', 'Save').should('be.visible')
  })

  it('can add a P witness', () => {
    cy.contains('.tc-section', 'P witnesses').contains('button', '+ Add witness').click()
    cy.contains('.tc-section', 'P witnesses').find('input[type="text"]').last().should('exist')
  })

  it('can remove a witness', () => {
    cy.contains('.tc-section', 'P witnesses').find('button.tc-remove-btn').first().click()
    cy.get('.tc-section').first().find('input[type="text"]').should('have.length', 1)
    cy.get('.tc-section').first().find('input[type="text"]').first().should('have.value', 'Bob')
  })

  it('swing witness section hidden by default', () => {
    cy.contains('Swing witnesses').should('not.exist')
  })

  it('shows swing witness section when checkbox is checked', () => {
    cy.contains('label', 'Case has swing witnesses').click()
    cy.contains('Swing witnesses').should('be.visible')
  })

  it('saves witnesses', () => {
    cy.intercept('PATCH', '/organizer/tournament/tourney-1/witnesses', { statusCode: 200, body: {} }).as('saveWitnesses')
    cy.intercept('PATCH', '/organizer/tournament/tourney-1/format', { statusCode: 200, body: {} }).as('saveFormat')
    cy.contains('button', 'Save').click()
    cy.contains('Saved successfully').should('be.visible')
  })
})
