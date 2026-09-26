const USER = {
  userId: '1',
  email: 'org@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
}

const TOURNAMENT_ID = 'tourney-1'
const PAIRING_ID = 'pair-1'
const BALLOT_ID = 'judge-1'

const VIEWER_PATH =
    `/organizer/${TOURNAMENT_ID}/pairing/${PAIRING_ID}/scoresheet/${BALLOT_ID}`
const SCORECARD_API =
    `/organizer/tournament/${TOURNAMENT_ID}/pairings/${PAIRING_ID}/scoresheets/${BALLOT_ID}`

const PROSECUTION_ID = 'eda58559-cb21-4f0a-b78b-e126120241ee'
const DEFENSE_ID = 'd612abe8-e26b-4277-8f38-bad042b8ad97'

const STUDENT_IDS = {
  Debbie: 'afc37a20-81a9-4912-abaa-dfc0b3369c03',
  Earl: 'ca0ed005-d2c7-43e5-8528-b0c33a680622',
  Isaac: '3b69627a-3a9a-4270-b28c-c426e2e2d3bd',
  Julie: '3b1a7080-e521-4745-8234-06b7120e7d74',
  Kevin: '37ac12c1-32f8-4ea8-a0fc-e4b3f244e67b',
  Lori: '559a3d0a-6c19-43d4-9eea-a7153dbc3fb7',
  Mike: '34f6a453-1669-4b95-81ad-42e477b8c6d1',
  Nancy: '62726d3b-a455-4480-ba55-d8f1fbdf5319',
  Omar: 'd066939e-d5cf-4d08-b5c0-669a3520ab6f',
  Patty: '10c94672-a4d5-4e91-a7df-fb29ad999dfb',
}

const STUDENTS = {
  [STUDENT_IDS.Debbie]: {
    name: 'Debbie',
    pronouns: 'she/her',
    schoolId: DEFENSE_ID,
  },
  [STUDENT_IDS.Earl]: {
    name: 'Earl',
    pronouns: 'he/him',
    schoolId: DEFENSE_ID,
  },
  [STUDENT_IDS.Isaac]: {
    name: 'Isaac',
    pronouns: 'he/him',
    schoolId: PROSECUTION_ID,
  },
  [STUDENT_IDS.Julie]: {
    name: 'Julie',
    pronouns: 'she/her',
    schoolId: PROSECUTION_ID,
  },
  [STUDENT_IDS.Kevin]: {
    name: 'Kevin',
    pronouns: 'he/him',
    schoolId: PROSECUTION_ID,
  },
  [STUDENT_IDS.Lori]: {
    name: 'Lori',
    pronouns: 'she/her',
    schoolId: PROSECUTION_ID,
  },
  [STUDENT_IDS.Mike]: {
    name: 'Mike',
    pronouns: 'he/him',
    schoolId: PROSECUTION_ID,
  },
  [STUDENT_IDS.Nancy]: {
    name: 'Nancy',
    pronouns: 'she/her',
    schoolId: PROSECUTION_ID,
  },
  [STUDENT_IDS.Omar]: {
    name: 'Omar',
    pronouns: 'he/him',
    schoolId: PROSECUTION_ID,
  },
  [STUDENT_IDS.Patty]: {
    name: 'Patty',
    pronouns: 'she/her',
    schoolId: PROSECUTION_ID,
  },
}

const PRETRIAL_CATEGORY_ID = '57505ac4-3cda-4389-8bd8-d0e26f8d2b75'
const PRETRIAL_P_KEY =
    `${PRETRIAL_CATEGORY_ID}__db271df8-a2be-42b0-b10c-2304fcd1b565`
const PRETRIAL_D_KEY =
    `${PRETRIAL_CATEGORY_ID}__8416acb5-9515-477a-9b75-66b4c1d9981e`
const OPENING_CATEGORY_ID = 'e05369b9-04ac-4829-8b6d-c421ed384097'
const CLOSING_CATEGORY_ID = 'c1ea6a6d-30d8-42c3-8f24-28000f12e83a'
const CLERK_CATEGORY_ID = 'a7e0e761-b315-472d-923d-7f3ddde47d2c'
const TEAM_CATEGORY_ID = '61ecf274-3bb3-4bc6-ae9e-8e7e6bf9f71e'
const DEDUCTIONS_CATEGORY_ID = 'dcb519aa-6d51-4ee3-843b-9dc345f82961'
const WITNESS_CATEGORY_BASE = 'dab9114f-3832-4132-9fc4-e4ed407cb3fc'
const DIRECT_ASSIGNMENT_ID = '163786e6-45ff-40e9-ac9c-197851203f97'
const CROSS_ASSIGNMENT_ID = '78fa8eb4-05a7-492e-ac2a-95263bb048cc'
const WITNESS_ASSIGNMENT_ID = 'afb45a48-9cdc-4989-a92f-25a3519decaa'
const ATTORNEY_AWARD_ID = 'ee15b19f-cbd5-4c2f-8650-05f1f6663130'

const WITNESS_CONFIGS = [
  {
    id: '0f633b41-0337-4b3f-a26d-503004554bae',
    name: 'Dylan Mavis',
    side: 'P',
    attorneyId: STUDENT_IDS.Kevin,
    witnessStudentId: STUDENT_IDS.Lori,
  },
  {
    id: '0ece9c83-292b-41f5-b035-d972d63563a5',
    name: 'Billie Scher',
    side: 'P',
    attorneyId: STUDENT_IDS.Kevin,
    witnessStudentId: STUDENT_IDS.Mike,
  },
  {
    id: 'f2c7ba32-62ca-409a-8d96-2353c6e8801d',
    name: 'Cleo Shafer',
    side: 'P',
    attorneyId: STUDENT_IDS.Julie,
    witnessStudentId: STUDENT_IDS.Nancy,
  },
  {
    id: 'c9dbb915-779f-4c49-91e1-159264169efb',
    name: 'Ari Kouch',
    side: 'P',
    attorneyId: STUDENT_IDS.Kevin,
    witnessStudentId: STUDENT_IDS.Omar,
  },
  {
    id: '28636d99-38c1-46a1-add8-81324924c483',
    name: 'Karter Lucky',
    side: 'D',
    attorneyId: STUDENT_IDS.Julie,
    witnessStudentId: STUDENT_IDS.Debbie,
  },
  {
    id: '478c42b7-6cf9-4400-bc5e-60f0107601d2',
    name: 'Jordan Franks (Def)',
    side: 'D',
    attorneyId: STUDENT_IDS.Kevin,
    witnessStudentId: STUDENT_IDS.Earl,
  },
  {
    id: 'd3b2b4e2-d09c-474d-b34e-6b62704f0a3d',
    name: 'Ezra Weintraub',
    side: 'D',
    attorneyId: STUDENT_IDS.Julie,
    witnessStudentId: null,
  },
  {
    id: '4ca1b069-841a-4206-b27e-fc616fa11dde',
    name: 'Jade Marquez',
    side: 'D',
    attorneyId: STUDENT_IDS.Kevin,
    witnessStudentId: null,
  },
]

const witnessCategoryId = (witnessId) =>
    `${WITNESS_CATEGORY_BASE}__${witnessId}`
const witnessAssignmentKey = (assignmentId, witnessId) =>
    `${WITNESS_CATEGORY_BASE}__${assignmentId}__${witnessId}`

const WITNESS_CATEGORIES = Object.fromEntries(
    WITNESS_CONFIGS.map((witness) => {
      const isProsecutionWitness = witness.side === 'P'
      return [
        witnessCategoryId(witness.id),
        {
          categoryName: 'Witnesses',
          witnessId: witness.id,
          categoryAssignments: [
            {
              assignmentName: 'Atty Direct',
              assignmentKey: witnessAssignmentKey(DIRECT_ASSIGNMENT_ID, witness.id),
              pStudentId: isProsecutionWitness ? witness.attorneyId : null,
              dStudentId: null,
              side: isProsecutionWitness ? 'P' : 'D',
              minScore: 0,
              maxScore: 10,
              multiplier: 1,
            },
            {
              assignmentName: 'Atty Cross',
              assignmentKey: witnessAssignmentKey(CROSS_ASSIGNMENT_ID, witness.id),
              pStudentId: isProsecutionWitness ? null : witness.attorneyId,
              dStudentId: null,
              side: isProsecutionWitness ? 'D' : 'P',
              minScore: 0,
              maxScore: 10,
              multiplier: 1,
            },
            {
              assignmentName: 'Witness',
              assignmentKey: witnessAssignmentKey(WITNESS_ASSIGNMENT_ID, witness.id),
              pStudentId: isProsecutionWitness ? witness.witnessStudentId : null,
              dStudentId: isProsecutionWitness ? null : witness.witnessStudentId,
              side: witness.side,
              minScore: 0,
              maxScore: 10,
              multiplier: 1,
            },
          ],
        },
      ]
    }),
)

const SCORING_CATEGORIES = {
  [PRETRIAL_CATEGORY_ID]: {
    categoryName: 'Pretrial',
    witnessId: null,
    categoryAssignments: [
      {
        assignmentName: 'Pretrial D',
        assignmentKey: PRETRIAL_D_KEY,
        pStudentId: null,
        dStudentId: null,
        side: 'D',
        minScore: 0,
        maxScore: 10,
        multiplier: 2,
      },
      {
        assignmentName: 'Pretrial P',
        assignmentKey: PRETRIAL_P_KEY,
        pStudentId: STUDENT_IDS.Isaac,
        dStudentId: null,
        side: 'P',
        minScore: 0,
        maxScore: 10,
        multiplier: 2,
      },
    ],
  },
  [OPENING_CATEGORY_ID]: {
    categoryName: 'Opening',
    witnessId: null,
    categoryAssignments: [
      {
        assignmentName: 'Opening',
        assignmentKey:
            `${OPENING_CATEGORY_ID}__d54893cb-dea8-466d-b562-a81d4818e0a5`,
        pStudentId: STUDENT_IDS.Julie,
        dStudentId: null,
        side: 'BOTH',
        minScore: 0,
        maxScore: 10,
        multiplier: 1,
      },
    ],
  },
  ...WITNESS_CATEGORIES,
  [CLOSING_CATEGORY_ID]: {
    categoryName: 'Closing',
    witnessId: null,
    categoryAssignments: [
      {
        assignmentName: 'Closing',
        assignmentKey:
            `${CLOSING_CATEGORY_ID}__5c1785b0-fe38-4c95-98e3-e9367529502c`,
        pStudentId: STUDENT_IDS.Kevin,
        dStudentId: null,
        side: 'BOTH',
        minScore: 0,
        maxScore: 10,
        multiplier: 2,
      },
    ],
  },
  [CLERK_CATEGORY_ID]: {
    categoryName: 'Clerk / Bailiff',
    witnessId: null,
    categoryAssignments: [
      {
        assignmentName: 'Clerk',
        assignmentKey:
            `${CLERK_CATEGORY_ID}__4fcf2749-e0e1-44dd-89b5-96cfc6622df1`,
        pStudentId: STUDENT_IDS.Patty,
        dStudentId: null,
        side: 'P',
        minScore: 0,
        maxScore: 10,
        multiplier: 1,
      },
      {
        assignmentName: 'Bailiff',
        assignmentKey:
            `${CLERK_CATEGORY_ID}__c6e3beec-50e3-43f7-aae1-c9aa815c81b7`,
        pStudentId: null,
        dStudentId: null,
        side: 'D',
        minScore: 0,
        maxScore: 10,
        multiplier: 1,
      },
    ],
  },
  [TEAM_CATEGORY_ID]: {
    categoryName: 'Team Score',
    witnessId: null,
    categoryAssignments: [
      {
        assignmentName: 'Team Score',
        assignmentKey:
            `${TEAM_CATEGORY_ID}__0ed170ad-fb49-4082-a4c9-ff039423a7a6`,
        pStudentId: null,
        dStudentId: null,
        side: 'BOTH',
        minScore: 0,
        maxScore: 10,
        multiplier: 1,
      },
    ],
  },
  [DEDUCTIONS_CATEGORY_ID]: {
    categoryName: 'Point Deductions',
    witnessId: null,
    categoryAssignments: [
      {
        assignmentName: 'Deductions',
        assignmentKey:
            `${DEDUCTIONS_CATEGORY_ID}__6cfeabab-ffdd-4f28-b91d-bd684504a40a`,
        pStudentId: null,
        dStudentId: null,
        side: 'BOTH',
        minScore: 0,
        maxScore: 100,
        multiplier: -1,
      },
    ],
  },
}

const CATEGORY_ORDER = [
  PRETRIAL_CATEGORY_ID,
  OPENING_CATEGORY_ID,
  ...WITNESS_CONFIGS.map((witness) => witnessCategoryId(witness.id)),
  CLOSING_CATEGORY_ID,
  CLERK_CATEGORY_ID,
  TEAM_CATEGORY_ID,
  DEDUCTIONS_CATEGORY_ID,
]

const SCORES = CATEGORY_ORDER.flatMap((categoryId) => {
  const category = SCORING_CATEGORIES[categoryId]
  return category.categoryAssignments.flatMap((assignment) => {
    const scores = []
    if (assignment.side !== 'D') {
      scores.push({
        side: 'P',
        score: 4,
        studentId: assignment.pStudentId ?? null,
        categoryId,
        assignmentKey: assignment.assignmentKey,
      })
    }
    if (assignment.side !== 'P') {
      scores.push({
        side: 'D',
        score: 4,
        studentId: assignment.dStudentId ?? null,
        categoryId,
        assignmentKey: assignment.assignmentKey,
      })
    }
    return scores
  })
})

const SCORECARD_RESPONSE = {
  sheet: {
    isCriminal: true,
    ballotOptions: {
      fillableScores: true,
      showTiebreaker: true,
    },
    pairingID: '4fc5873c-1276-4852-a650-9cdf8c14182d',
    scorer: {
      firstName: 'FirstName',
      lastName: 'LastName',
      scorerID: '15622afa-c718-4272-badb-c28cbb85d8cf',
      isPaper: false,
    },
    presiderName: 'FirstName LastName',
    courtroomNumber: '',
    caseName: 'People v. Franks',
    tournamentName: 'Orientation Completed Tournament',
    prosecutionCode: 'HS 1',
    defenseCode: 'HS 2',
    prosecutionId: PROSECUTION_ID,
    defenseId: DEFENSE_ID,
    students: STUDENTS,
    witnesses: Object.fromEntries(
        WITNESS_CONFIGS.map((witness) => [
          witness.id,
          { characterName: witness.name },
        ]),
    ),
    scoringCategories: SCORING_CATEGORIES,
    categoryOrder: CATEGORY_ORDER,
    awardCategories: {
      [ATTORNEY_AWARD_ID]: {
        name: 'Outstanding Attorney',
        minNominees: 0,
        maxNominees: 6,
        eligibleStudentIds: [STUDENT_IDS.Kevin, STUDENT_IDS.Julie],
      },
      'bd6c8062-850c-488a-a17e-830b4ed0d9e0': {
        name: 'Outstanding Bailiff',
        minNominees: 0,
        maxNominees: 1,
        eligibleStudentIds: [],
      },
      '22bc5854-6c4e-4b64-a25c-9fa91d4ae88d': {
        name: 'Outstanding Clerk',
        minNominees: 0,
        maxNominees: 1,
        eligibleStudentIds: [STUDENT_IDS.Patty],
      },
      '1ece0021-0658-4bb5-88f3-ed1fcfb5ea4b': {
        name: 'Outstanding Pretrial',
        minNominees: 0,
        maxNominees: 2,
        eligibleStudentIds: [STUDENT_IDS.Isaac],
      },
      '2f561dc2-8911-4692-a8b1-3b008ef4ab26': {
        name: 'Outstanding Witness',
        minNominees: 0,
        maxNominees: 8,
        eligibleStudentIds: [
          STUDENT_IDS.Debbie,
          STUDENT_IDS.Earl,
          STUDENT_IDS.Lori,
          STUDENT_IDS.Omar,
          STUDENT_IDS.Nancy,
          STUDENT_IDS.Mike,
        ],
      },
    },
  },
  ballot: {
    ballot_id: 'dba4b975-990c-407d-b813-fa48d8ede851',
    scorer_assignment_id: '15622afa-c718-4272-badb-c28cbb85d8cf',
    tournament_id: 'afd56fec-1f91-4f4a-8fa2-79a0faf255a9',
    pairing_id: '4fc5873c-1276-4852-a650-9cdf8c14182d',
    p_team_id: PROSECUTION_ID,
    d_team_id: DEFENSE_ID,
    d_points: 72,
    p_points: 72,
    presider_ballot: true,
    tiebreaker: PROSECUTION_ID,
    ballot_json: {
      pairingID: '4fc5873c-1276-4852-a650-9cdf8c14182d',
      scores: SCORES,
      tiebreaker: PROSECUTION_ID,
      nominations: [
        {
          rank: 1,
          studentId: STUDENT_IDS.Julie,
          awardCategoryId: ATTORNEY_AWARD_ID,
        },
        {
          rank: 2,
          studentId: STUDENT_IDS.Kevin,
          awardCategoryId: ATTORNEY_AWARD_ID,
        },
      ],
    },
  },
  editLog: [],
}

const cloneResponse = () => JSON.parse(JSON.stringify(SCORECARD_RESPONSE))

const visitScorecard = ({
                          body = cloneResponse(),
                          statusCode = 200,
                          onBeforeLoad,
                        } = {}) => {
  cy.intercept('GET', SCORECARD_API, (request) => {
    const responseBody = typeof body === 'function' ? body() : body
    request.reply({ statusCode, body: responseBody })
  }).as('getScorecard')

  cy.visit(VIEWER_PATH, onBeforeLoad ? { onBeforeLoad } : {})
  cy.wait('@session')
  cy.wait('@getScorecard')
}

describe('Scorecard Viewer', () => {
  beforeEach(() => {
    cy.loginAs(USER)
  })

  it('loads the submitted ballot and displays the trial details', () => {
    visitScorecard()

    cy.contains('h2', 'Scorecard - FirstName LastName').should('be.visible')
    cy.contains('.sv-case-name', 'People v. Franks').should('be.visible')
    cy.contains('.trial-info-presider', 'FirstName LastName').should('be.visible')

    cy.get('.team-label--prosecution')
        .should('contain.text', 'HS 1')
        .and('contain.text', 'Prosecution')
    cy.get('.team-label--defense')
        .should('contain.text', 'HS 2')
        .and('contain.text', 'Defense')
  })

  it('renders every score category, assignment, score, and student mapping', () => {
    visitScorecard()

    cy.get('#score-table tbody').should('have.length', 14)
    cy.get('#score-table tr.score-row').should('have.length', 32)
    cy.get('#score-table .sv-score-input-view')
        .should('have.length', 36)
        .each(($score) => {
          cy.wrap($score).should('have.text', '4')
        })

    cy.contains('#score-table tr.category-name', 'Witnesses - Dylan Mavis')
        .parent('tbody')
        .within(() => {
          cy.contains('tr.score-row', 'Atty Direct')
              .should('contain.text', 'Kevin')
              .and('contain.text', '4')
          cy.contains('tr.score-row', 'Witness')
              .should('contain.text', 'Lori')
              .and('contain.text', '4')
        })

    cy.contains('#score-table tr.category-name', 'Witnesses - Karter Lucky')
        .parent('tbody')
        .within(() => {
          cy.contains('tr.score-row', 'Atty Cross')
              .should('contain.text', 'Julie')
              .and('contain.text', '4')
          cy.contains('tr.score-row', 'Witness')
              .should('contain.text', 'Debbie')
              .and('contain.text', '4')
        })
  })

  it('shows weighted totals, ranked nominations, and the selected tiebreaker', () => {
    visitScorecard()

    cy.get('.sv-totals').within(() => {
      cy.contains(/HS 1 \(Prosecution\) Total:\s*72/).should('be.visible')
      cy.contains(/HS 2 \(Defense\) Total:\s*72/).should('be.visible')
    })

    cy.contains('.sv-nomination-group', 'Outstanding Attorney').within(() => {
      cy.get('li').should('have.length', 2)
      cy.get('li')
          .eq(0)
          .should('contain.text', 'Julie - Rank 1')
          .and('contain.text', 'Prosecution')
      cy.get('li')
          .eq(1)
          .should('contain.text', 'Kevin - Rank 2')
          .and('contain.text', 'Prosecution')
    })

    cy.contains('.sv-section--sm', 'Tiebreaker Selection').within(() => {
      cy.contains('strong', 'HS 1').should('be.visible')
      cy.contains(/HS 1\s*-\s*Prosecution/).should('be.visible')
    })
  })

  it('exports the visible ballot rows as CSV', () => {
    let exportedBlob

    visitScorecard({
      onBeforeLoad(win) {
        cy.stub(win.URL, 'createObjectURL').callsFake((blob) => {
          exportedBlob = blob
          return 'blob:scorecard-export'
        })
        cy.stub(win.URL, 'revokeObjectURL')
        cy.stub(win.HTMLAnchorElement.prototype, 'click').as('downloadClick')
      },
    })

    cy.contains('button', 'Export CSV').click()
    cy.get('@downloadClick').should('have.been.calledOnce')

    cy.then(async () => {
      expect(exportedBlob, 'exported CSV blob').to.exist
      const csv = await exportedBlob.text()
      const rows = csv.split('\n')

      expect(rows).to.have.length(37)
      expect(rows[0]).to.equal('Category,Field,Side,Score,Student')
      expect(rows).to.include('Pretrial,Pretrial P,P,4,Isaac')
      expect(rows).to.include('Witnesses — Dylan Mavis,Witness,P,4,Lori')
      expect(rows).to.include('Witnesses — Karter Lucky,Witness,D,4,Debbie')
      expect(rows).to.include('Point Deductions,Deductions,D,4,')
    })
  })

  it('requires an edit reason, saves only score changes, and refreshes the audit log', () => {
    const initialResponse = cloneResponse()
    const refreshedResponse = cloneResponse()
    const editReason = 'Scorer reported an incorrect pretrial score'
    let editsSaved = false

    visitScorecard({
      body: () => (editsSaved ? refreshedResponse : initialResponse),
    })

    cy.contains('button', 'Edit Scores').click()
    cy.get('input.sv-score-input-edit').should('have.length', 36)
    cy.get('input[aria-label="Prosecution score for Pretrial P"]')
        .should('have.value', '4')
        .type('{selectall}6')
        .should('have.value', '6')

    cy.contains('button', 'Save Changes').click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('h2', 'Save Ballot Edits').should('be.visible')
      cy.contains('button', 'Confirm Edit').should('be.disabled')
      cy.get('#edit-reason')
          .should('be.focused')
          .type(editReason)
      cy.contains('button', 'Confirm Edit').should('be.enabled')
    })

    const refreshedScore = refreshedResponse.ballot.ballot_json.scores.find(
        (score) =>
            score.assignmentKey === PRETRIAL_P_KEY && score.side === 'P',
    )
    refreshedScore.score = 6
    refreshedResponse.ballot.p_points = 76
    refreshedResponse.editLog = [
      {
        editor_email: USER.email,
        edited_at: '2026-09-26T06:30:00.000Z',
        reason: editReason,
        p_points_before: 72,
        p_points_after: 76,
        d_points_before: 72,
        d_points_after: 72,
      },
    ]

    cy.intercept('PUT', SCORECARD_API, (request) => {
      const requestBody =
          typeof request.body === 'string'
              ? JSON.parse(request.body)
              : request.body

      expect(requestBody.reason).to.equal(editReason)
      expect(requestBody.scores).to.have.length(36)

      const changedScore = requestBody.scores.find(
          (score) =>
              score.assignmentKey === PRETRIAL_P_KEY && score.side === 'P',
      )
      expect(changedScore).to.deep.include({
        assignmentKey: PRETRIAL_P_KEY,
        categoryId: PRETRIAL_CATEGORY_ID,
        studentId: STUDENT_IDS.Isaac,
        side: 'P',
        score: 6,
      })

      const untouchedScore = requestBody.scores.find(
          (score) =>
              score.assignmentKey ===
              witnessAssignmentKey(WITNESS_ASSIGNMENT_ID, WITNESS_CONFIGS[0].id) &&
              score.side === 'P',
      )
      expect(untouchedScore).to.deep.include({
        categoryId: witnessCategoryId(WITNESS_CONFIGS[0].id),
        studentId: STUDENT_IDS.Lori,
        side: 'P',
        score: 4,
      })

      editsSaved = true
      request.reply({ statusCode: 204 })
    }).as('saveScorecard')

    cy.get('[role="dialog"]')
        .contains('button', 'Confirm Edit')
        .click()

    cy.wait('@saveScorecard')
    cy.wait('@getScorecard')

    cy.get('input.sv-score-input-edit').should('not.exist')
    cy.contains('#score-table tr.score-row', 'Pretrial P').within(() => {
      cy.get('.sv-score-input-view').should('have.text', '6')
    })
    cy.get('.sv-totals')
        .contains(/HS 1 \(Prosecution\) Total:\s*76/)
        .should('be.visible')

    cy.contains('button', 'Ballot contains 1 edit')
        .should('have.attr', 'aria-expanded', 'false')
        .click()
        .should('have.attr', 'aria-expanded', 'true')

    cy.get('.sv-editlog-entry')
        .should('contain.text', USER.email)
        .and('contain.text', 'P: 72 → 76 | D: 72 → 72')
        .and('contain.text', editReason)
  })

  it('cancels score editing without changing the displayed ballot', () => {
    visitScorecard()

    cy.contains('button', 'Edit Scores').click()
    cy.get('input[aria-label="Prosecution score for Pretrial P"]')
        .clear()
        .type('9')
    cy.contains('button', 'Cancel').click()

    cy.get('input.sv-score-input-edit').should('not.exist')
    cy.contains('#score-table tr.score-row', 'Pretrial P').within(() => {
      cy.get('.sv-score-input-view').should('have.text', '4')
    })
    cy.get('.sv-totals')
        .contains(/HS 1 \(Prosecution\) Total:\s*72/)
        .should('be.visible')
  })

  it('confirms before deleting the ballot', () => {
    visitScorecard()

    let deleteRequests = 0
    cy.intercept('DELETE', SCORECARD_API, (request) => {
      deleteRequests += 1
      request.reply({ statusCode: 204 })
    }).as('deleteScorecard')
    cy.window().then((win) => {
      cy.stub(win.history, 'go').as('historyGo')
    })

    cy.contains('button', 'Delete Ballot').click()
    cy.get('[role="dialog"]').within(() => {
      cy.contains('h2', 'Delete Ballot').should('be.visible')
      cy.contains('This action cannot be undone').should('be.visible')
      cy.contains('button', 'Cancel').click()
    })
    cy.get('[role="dialog"]').should('not.exist')
    cy.then(() => {
      expect(deleteRequests).to.equal(0)
    })

    cy.contains('button', 'Delete Ballot').click()
    cy.get('[role="dialog"]')
        .contains('button', 'Confirm Delete')
        .click()

    cy.wait('@deleteScorecard')
        .its('request.method')
        .should('equal', 'DELETE')
    cy.get('@historyGo').should('have.been.calledWith', -1)
  })

  it('navigates back using browser history', () => {
    visitScorecard()

    cy.window().then((win) => {
      cy.stub(win.history, 'go').as('historyGo')
    })
    cy.contains('button', '← Back to tournament').click()
    cy.get('@historyGo').should('have.been.calledWith', -1)
  })

  it('shows an empty state when the sheet exists but no ballot was submitted', () => {
    const response = cloneResponse()
    response.ballot = null

    visitScorecard({ body: response })

    cy.contains('h2', 'Scorecard - FirstName LastName').should('be.visible')
    cy.contains('No ballot has been submitted yet.').should('be.visible')
    cy.get('#score-table').should('not.exist')
    cy.contains('button', 'Export CSV').should('not.exist')
    cy.contains('button', 'Edit Scores').should('not.exist')
    cy.contains('button', 'Delete Ballot').should('not.exist')
  })

  it('shows the load error returned by a failed scorecard request', () => {
    visitScorecard({ statusCode: 500, body: { message: 'Server error' } })

    cy.contains('Failed to load scorecard').should('be.visible')
    cy.get('#score-table').should('not.exist')
  })
})
