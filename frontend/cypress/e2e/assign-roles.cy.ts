const USER = { userId: '2', email: 'coach@example.com', firstName: 'Bob', lastName: 'Coach' }

const CATEGORIES = [
  {
    id: 'cat-1',
    name: 'Attorneys',
    witnessCategory: false,
    position: 0,
    fields: [
      { id: 'f-1', label: 'Opening Statement', min: 1, max: 10, multiplier: 1, assignable: true, eligibleForAward: false, visibleToScorers: true, prosecution: true, defense: false, calling: false, crossing: false },
      { id: 'f-2', label: 'Closing Argument', min: 1, max: 10, multiplier: 1, assignable: true, eligibleForAward: false, visibleToScorers: true, prosecution: true, defense: false, calling: false, crossing: false },
    ],
  },
]

const WITNESSES: { id: string; name: string; side: string }[] = []
const STUDENTS = [
  { student_id: 's-1', team_id: 'team-1', student_name: 'Alice Student', pronouns: 'she/her' },
  { student_id: 's-2', team_id: 'team-1', student_name: 'Bob Student', pronouns: 'he/him' },
]

describe('Assign Roles page', () => {
  const URL = '/coach/t-1/assign-roles/team-1/p-1/p'

  beforeEach(() => {
    cy.loginAs(USER)
    cy.intercept('GET', '/coach/tournaments/t-1/scoring-categories', { statusCode: 200, body: CATEGORIES }).as('getCats')
    cy.intercept('GET', '/coach/tournaments/t-1/witnesses', { statusCode: 200, body: WITNESSES }).as('getWitnesses')
    cy.intercept('GET', '/coach/teams/team-1/students', { statusCode: 200, body: STUDENTS }).as('getStudents')
    cy.intercept('GET', '/coach/teams/team-1/pairings/p-1/assignments', { statusCode: 200, body: [] }).as('getAssignments')
    cy.intercept('GET', '/coach/teams/team-1/default-assignments', { statusCode: 200, body: [] }).as('getDefaults')
    cy.visit(URL)
    cy.wait('@session')
    cy.wait('@getCats')
    cy.wait('@getWitnesses')
    cy.wait('@getStudents')
    cy.wait('@getAssignments')
    cy.wait('@getDefaults')
  })

  it('renders the Assign Roles heading', () => {
    cy.contains('h1', 'Assign Roles').should('be.visible')
  })

  it('shows the side label (Prosecution)', () => {
    cy.contains('Prosecution').should('be.visible')
  })

  it('renders a row for each assignable prosecution field', () => {
    cy.contains('td', 'Opening Statement').should('be.visible')
    cy.contains('td', 'Closing Argument').should('be.visible')
  })

  it('shows all students in each select dropdown', () => {
    cy.get('select.rv-select').first().within(() => {
      cy.contains('Alice Student').should('exist')
      cy.contains('Bob Student').should('exist')
    })
  })

  it('can select a student and save', () => {
    cy.intercept('POST', '/coach/teams/team-1/pairings/p-1/assignments/bulk', { statusCode: 200, body: { success: true } }).as('saveAssignments')
    cy.get('select.rv-select').first().select('s-1')
    cy.contains('button', 'Save').click()
    cy.wait('@saveAssignments')
  })

  it('Cancel button navigates back', () => {
    cy.contains('button', 'Cancel').click()
    // navigates back (can't assert exact URL without history, but confirm we left the page)
    cy.url().should('not.include', '/assign-roles')
  })

  it('shows "No assignable roles" message for defense side with prosecution-only fields', () => {
    cy.intercept('GET', '/coach/tournaments/t-1/scoring-categories', { statusCode: 200, body: CATEGORIES }).as('getCats2')
    cy.intercept('GET', '/coach/tournaments/t-1/witnesses', { statusCode: 200, body: WITNESSES }).as('getWitnesses2')
    cy.intercept('GET', '/coach/teams/team-1/students', { statusCode: 200, body: STUDENTS }).as('getStudents2')
    cy.intercept('GET', '/coach/teams/team-1/pairings/p-1/assignments', { statusCode: 200, body: [] }).as('getAssignments2')
    cy.intercept('GET', '/coach/teams/team-1/default-assignments', { statusCode: 200, body: [] }).as('getDefaults2')
    cy.visit('/coach/t-1/assign-roles/team-1/p-1/d')  // defense side
    cy.wait('@session')
    cy.wait('@getCats2')
    cy.contains('No assignable roles for this side.').should('be.visible')
  })
})
