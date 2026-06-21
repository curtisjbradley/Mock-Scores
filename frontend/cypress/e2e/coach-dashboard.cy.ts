const USER = { userId: '2', email: 'coach@example.com', firstName: 'Bob', lastName: 'Coach' }

const TOURNAMENT = {
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
}

const SCHEDULE: { round_id: string; name: string; round_time: null; pairings: { pairing_id: string; p_team_id: string; p_team_name: string; p_team_code: string; d_team_id: string; d_team_name: string; d_team_code: string; courtroom_name: string }[] }[] = [
  {
    round_id: 'r-1',
    name: 'Round 1',
    round_time: null,
    pairings: [
      {
        pairing_id: 'p-1',
        p_team_id: 'team-1',
        p_team_name: 'Lincoln High',
        p_team_code: '101',
        d_team_id: 'team-2',
        d_team_name: 'Jefferson High',
        d_team_code: '102',
        courtroom_name: 'Dept. 5',
      },
    ],
  },
]

const STUDENTS = [
  { student_id: 's-1', team_id: 'team-1', student_name: 'Alice Student', pronouns: 'she/her' },
  { student_id: 's-2', team_id: 'team-1', student_name: 'Bob Student', pronouns: 'he/him' },
]

const COACHES = [
  { coach_id: 'c-1', name: 'Bob Coach', email: 'coach@example.com', is_owner: true, has_joined: true },
]

function stubCoachDashboard() {
  cy.intercept('GET', '/api/coach/tournaments', { statusCode: 200, body: [TOURNAMENT] }).as('getTournaments')
  cy.intercept('GET', '/api/coach/tournaments/t-1/schedule', { statusCode: 200, body: SCHEDULE }).as('getSchedule')
  cy.intercept('GET', '/api/coach/tournaments/t-1/results', { statusCode: 200, body: [] }).as('getResults')
  cy.intercept('GET', '/api/coach/teams/team-1/students', { statusCode: 200, body: STUDENTS }).as('getStudents')
  cy.intercept('GET', '/api/coach/teams/team-1/coaches', { statusCode: 200, body: COACHES }).as('getCoaches')
  cy.intercept('GET', '/api/coach/tournaments/t-1/field', { statusCode: 200, body: [] }).as('getField')
  cy.intercept('GET', '/api/coach/tournaments/t-1/standings', { statusCode: 200, body: null }).as('getStandings')
}

describe('Coach Dashboard', () => {
  beforeEach(() => {
    cy.loginAs(USER)
    stubCoachDashboard()
    cy.visit('/coach/t-1')
    cy.wait('@session')
    cy.wait('@getTournaments')
    cy.wait('@getSchedule')
  })

  it('renders the team name, tournament name, and meta', () => {
    cy.contains('Lincoln High').should('be.visible')
    cy.contains('Spring Invitational').should('be.visible')
    cy.contains('8 teams').should('be.visible')
    cy.contains('3 rounds').should('be.visible')
  })

  it('shows the schedule tab by default with pairings', () => {
    cy.contains('Round 1').should('be.visible')
    cy.contains('Lincoln High').should('be.visible')
    cy.contains('Jefferson High').should('be.visible')
    cy.contains('Dept. 5').should('be.visible')
  })

  it('all tab buttons are visible', () => {
    cy.contains('button', 'Schedule').should('be.visible')
    cy.contains('button', 'Results').should('be.visible')
    cy.contains('button', 'Coaches').should('be.visible')
    cy.contains('button', 'Roster').should('be.visible')
    cy.contains('button', 'Field').should('be.visible')
    cy.contains('button', 'Standings').should('be.visible')
  })

  it('Schedule tab is active by default', () => {
    cy.contains('button', 'Schedule').should('have.class', 'dash-tab--active')
  })

  it('switches to Results tab', () => {
    cy.contains('button', 'Results').click()
    cy.url().should('include', 'page=results')
  })

  it('switches to Roster tab and shows students', () => {
    cy.contains('button', 'Roster').click()
    cy.wait('@getStudents')
    cy.contains('Alice Student').should('be.visible')
    cy.contains('Bob Student').should('be.visible')
  })

  it('adds a student from the Roster tab', () => {
    cy.intercept('POST', '/api/coach/teams/team-1/students', {
      statusCode: 200,
      body: { student_id: 's-3', team_id: 'team-1', student_name: 'Charlie Student', pronouns: 'they/them' },
    }).as('addStudent')
    cy.contains('button', 'Roster').click()
    cy.wait('@getStudents')
    cy.get('input[placeholder="Student name"]').type('Charlie Student')
    cy.get('select').select('they/them (Mx)')
    cy.contains('button', '+ Add').click()
    cy.wait('@addStudent')
    cy.contains('Charlie Student').should('be.visible')
  })

  it('shows validation error when adding a student without a name', () => {
    cy.contains('button', 'Roster').click()
    cy.wait('@getStudents')
    // Submit via JS to bypass browser's native `required` validation on the select
    cy.get('form.roster-add-form').then($form => $form[0].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    cy.contains('Please enter a student name.').should('be.visible')
  })

  it('shows validation error when adding a student without pronouns', () => {
    cy.contains('button', 'Roster').click()
    cy.wait('@getStudents')
    cy.get('input[placeholder="Student name"]').type('Charlie')
    cy.get('form.roster-add-form').then($form => $form[0].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    cy.contains('Please select pronouns.').should('be.visible')
  })

  it('removes a student from the Roster tab', () => {
    cy.intercept('DELETE', '/api/coach/teams/team-1/students/s-1', { statusCode: 200, body: {} }).as('removeStudent')
    cy.contains('button', 'Roster').click()
    cy.wait('@getStudents')
    cy.contains('li', 'Alice Student').find('button').click()
    cy.wait('@removeStudent')
    cy.contains('Alice Student').should('not.exist')
  })

  it('switches to Coaches tab and shows coaches', () => {
    cy.contains('button', 'Coaches').click()
    cy.wait('@getCoaches')
    cy.contains('Bob Coach').should('be.visible')
  })

  it('back button navigates to /coach', () => {
    cy.intercept('GET', '/api/coach/tournaments', { statusCode: 200, body: [] }).as('homeList')
    cy.contains('button', '← All tournaments').click()
    cy.url().should('include', '/coach')
    cy.url().should('not.include', '/t-1')
  })

  it('navigating directly to ?page=roster sets the correct active tab', () => {
    cy.visit('/coach/t-1?page=roster')
    cy.wait('@session')
    cy.wait('@getTournaments')
    cy.wait('@getStudents')
    cy.contains('button', 'Roster').should('have.class', 'dash-tab--active')
  })
})
