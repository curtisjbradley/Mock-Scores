const USER = { userId: '1', email: 'org@example.com', firstName: 'Alice', lastName: 'Smith' }
const TOURNAMENT = { id: 'tourney-1', name: 'Spring Invitational', location: 'Downtown', start_date: null, end_date: null, num_teams: 0, num_rounds: 0 }
const FORMAT = { case_name: 'People v. Test', criminal_case: true, p_witnesses_called: 2, d_witnesses_called: 1, has_swing: false }
const CATEGORIES = [
  {
    id: 'cat-1',
    name: 'Witnesses',
    witnessCategory: true,
    position: 0,
    fields: [
      { id: 'f-1', label: 'Direct Exam', min: 1, max: 10, multiplier: 1, assignable: true, eligibleForAward: true, visibleToScorers: true, prosecution: true, defense: true, calling: true, crossing: false, position: 0 },
    ],
  },
]

function stubScoringTab() {
  cy.intercept('GET', '/organizer/tournament/tourney-1', { statusCode: 200, body: TOURNAMENT }).as('getTournament')
  cy.intercept('GET', '/organizer/tournament/tourney-1/scoring-categories', { statusCode: 200, body: CATEGORIES }).as('getCategories')
  cy.intercept('GET', '/organizer/tournament/tourney-1/format', { statusCode: 200, body: FORMAT }).as('getFormat')
}

describe('Scoring Tab', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubScoringTab()
    cy.visit('/organizer/tourney-1?page=scoring')
    cy.wait('@session')
    cy.wait('@getTournament')
  })


  it('renders a Save button', () => {
    cy.contains('button', /save/i).should('exist')
  })

  it('saves scoring categories', () => {
    cy.intercept('PATCH', '/organizer/tournament/tourney-1/scoring-categories', { statusCode: 200, body: {} }).as('saveCategories')
    cy.contains('button', /save/i).click()
    cy.wait('@saveCategories')
  })
})
