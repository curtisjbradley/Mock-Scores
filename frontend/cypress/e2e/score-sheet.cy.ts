const SCORER_ID = '2b67d899-7866-40e9-b66a-656b7bb8c057'
const URL = `/score/${SCORER_ID}`

const selectTiebreaker = (teamId: string) => {
  const selector = `input[name="tiebreaker"][value="${teamId}"]`

  cy.get(selector)
      .closest('label.tiebreaker-option')
      .click()

  cy.get(selector).should('be.checked')
}

const SCORE_SHEET_RESPONSE = {
  "isCriminal": true,
  "ballotOptions": {
    "fillableScores": true,
    "showTiebreaker": true
  },
  "pairingID": "7a019e58-3487-4bd3-b0d1-3a49f3885a2e",
  "scorer": {
    "firstName": "Dana",
    "lastName": "Mitchell",
    "scorerID": SCORER_ID,
    "isPaper": false
  },
  "presiderName": "Hon. Elena Garcia",
  "courtroomNumber": "Department 12",
  "caseName": "People v. Jordan Blake",
  "tournamentName": "California Mock Trial Invitational",
  "prosecutionCode": "P-101",
  "defenseCode": "D-202",
  "prosecutionId": "678f4890-e247-4bac-b918-7d6f2570cef9",
  "defenseId": "41419043-af70-4dc8-b3e9-0a3630455fe5",
  "students": {
    "05f425cd-b231-4c31-b97f-a92dc4219501": {
      "name": "Priya Shah",
      "pronouns": "she/her",
      "schoolId": "678f4890-e247-4bac-b918-7d6f2570cef9"
    },
    "caa9e181-5f2a-4b4e-8234-2997ef95c745": {
      "name": "Elena Ruiz",
      "pronouns": "she/her",
      "schoolId": "678f4890-e247-4bac-b918-7d6f2570cef9"
    },
    "db41b8ad-8048-483d-80ab-674102a9e36d": {
      "name": "Noah Williams",
      "pronouns": "he/him",
      "schoolId": "678f4890-e247-4bac-b918-7d6f2570cef9"
    },
    "a1853d0c-d1de-4f39-99b0-f5823819ee3b": {
      "name": "Sofia Ramirez",
      "pronouns": "she/her",
      "schoolId": "678f4890-e247-4bac-b918-7d6f2570cef9"
    },
    "4f39e987-840f-4597-9c67-4876110ecf42": {
      "name": "Marcus Lee",
      "pronouns": "he/him",
      "schoolId": "41419043-af70-4dc8-b3e9-0a3630455fe5"
    },
    "d1f7a099-4430-45d8-bd91-d12152f6322e": {
      "name": "Maya Thompson",
      "pronouns": "she/her",
      "schoolId": "41419043-af70-4dc8-b3e9-0a3630455fe5"
    },
    "85cd96df-5347-4afd-858d-1af4bc4ed4f7": {
      "name": "Liam Nguyen",
      "pronouns": "he/him",
      "schoolId": "41419043-af70-4dc8-b3e9-0a3630455fe5"
    },
    "6ff75d80-cc12-4e87-a7c8-3c7156ef23b2": {
      "name": "Avery Chen",
      "pronouns": "they/them",
      "schoolId": "41419043-af70-4dc8-b3e9-0a3630455fe5"
    }
  },
  "witnesses": {
    "3abef43c-66eb-48a5-be4b-d5d5338bf766": {
      "characterName": "Dr. Riley Morgan"
    },
    "89e7121b-dedd-4405-9cf7-0200a487077d": {
      "characterName": "Detective Cameron Brooks"
    }
  },
  "scoringCategories": {
    "dbd49fc5-ec98-4bc2-8e44-1114bb3e66b1": {
      "categoryName": "Pretrial",
      "witnessId": null,
      "categoryAssignments": [
        {
          "assignmentName": "Pretrial D",
          "assignmentKey": "dbd49fc5-ec98-4bc2-8e44-1114bb3e66b1__023f03b6-6274-43af-a8c0-b56f37d5cba7",
          "pStudentId": null,
          "dStudentId": "4f39e987-840f-4597-9c67-4876110ecf42",
          "side": "D",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 2
        },
        {
          "assignmentName": "Pretrial P",
          "assignmentKey": "dbd49fc5-ec98-4bc2-8e44-1114bb3e66b1__8f2700af-ae5c-4594-9811-343c28ae5344",
          "pStudentId": "05f425cd-b231-4c31-b97f-a92dc4219501",
          "dStudentId": null,
          "side": "P",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 2
        }
      ]
    },
    "b6c0506a-192b-44f4-bbbf-e6e62165672e": {
      "categoryName": "Opening",
      "witnessId": null,
      "categoryAssignments": [
        {
          "assignmentName": "Opening",
          "assignmentKey": "b6c0506a-192b-44f4-bbbf-e6e62165672e__8534d2eb-5784-4b15-b611-5d454ac45d35",
          "pStudentId": "05f425cd-b231-4c31-b97f-a92dc4219501",
          "dStudentId": "4f39e987-840f-4597-9c67-4876110ecf42",
          "side": "BOTH",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        }
      ]
    },
    "2b475720-a356-4b38-ac93-acdabce77b01__3abef43c-66eb-48a5-be4b-d5d5338bf766": {
      "categoryName": "Witnesses",
      "witnessId": "3abef43c-66eb-48a5-be4b-d5d5338bf766",
      "categoryAssignments": [
        {
          "assignmentName": "Atty Direct",
          "assignmentKey": "2b475720-a356-4b38-ac93-acdabce77b01__84d0782b-46bb-4052-9f87-4a21572c6967__3abef43c-66eb-48a5-be4b-d5d5338bf766",
          "pStudentId": "caa9e181-5f2a-4b4e-8234-2997ef95c745",
          "dStudentId": null,
          "side": "P",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        },
        {
          "assignmentName": "Atty Cross",
          "assignmentKey": "2b475720-a356-4b38-ac93-acdabce77b01__a22e9343-a11f-46f9-b2a2-74fd51e465c1__3abef43c-66eb-48a5-be4b-d5d5338bf766",
          "pStudentId": null,
          "dStudentId": "d1f7a099-4430-45d8-bd91-d12152f6322e",
          "side": "D",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        },
        {
          "assignmentName": "Witness",
          "assignmentKey": "2b475720-a356-4b38-ac93-acdabce77b01__4544386e-ae1f-49bd-8d4a-784322dc7783__3abef43c-66eb-48a5-be4b-d5d5338bf766",
          "pStudentId": "db41b8ad-8048-483d-80ab-674102a9e36d",
          "dStudentId": null,
          "side": "P",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        }
      ]
    },
    "2b475720-a356-4b38-ac93-acdabce77b01__89e7121b-dedd-4405-9cf7-0200a487077d": {
      "categoryName": "Witnesses",
      "witnessId": "89e7121b-dedd-4405-9cf7-0200a487077d",
      "categoryAssignments": [
        {
          "assignmentName": "Atty Direct",
          "assignmentKey": "2b475720-a356-4b38-ac93-acdabce77b01__84d0782b-46bb-4052-9f87-4a21572c6967__89e7121b-dedd-4405-9cf7-0200a487077d",
          "pStudentId": null,
          "dStudentId": "d1f7a099-4430-45d8-bd91-d12152f6322e",
          "side": "D",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        },
        {
          "assignmentName": "Atty Cross",
          "assignmentKey": "2b475720-a356-4b38-ac93-acdabce77b01__a22e9343-a11f-46f9-b2a2-74fd51e465c1__89e7121b-dedd-4405-9cf7-0200a487077d",
          "pStudentId": "caa9e181-5f2a-4b4e-8234-2997ef95c745",
          "dStudentId": null,
          "side": "P",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        },
        {
          "assignmentName": "Witness",
          "assignmentKey": "2b475720-a356-4b38-ac93-acdabce77b01__4544386e-ae1f-49bd-8d4a-784322dc7783__89e7121b-dedd-4405-9cf7-0200a487077d",
          "pStudentId": null,
          "dStudentId": "85cd96df-5347-4afd-858d-1af4bc4ed4f7",
          "side": "D",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        }
      ]
    },
    "7e64e4da-ce60-4221-8b96-13a8588678f5": {
      "categoryName": "Closing",
      "witnessId": null,
      "categoryAssignments": [
        {
          "assignmentName": "Closing",
          "assignmentKey": "7e64e4da-ce60-4221-8b96-13a8588678f5__56b29e08-e87b-43a6-97c7-ec3c1c75b4ea",
          "pStudentId": "05f425cd-b231-4c31-b97f-a92dc4219501",
          "dStudentId": "4f39e987-840f-4597-9c67-4876110ecf42",
          "side": "BOTH",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 2
        }
      ]
    },
    "51df203a-6a69-42a9-8f4f-84444cc5ba05": {
      "categoryName": "Clerk / Bailiff",
      "witnessId": null,
      "categoryAssignments": [
        {
          "assignmentName": "Clerk",
          "assignmentKey": "51df203a-6a69-42a9-8f4f-84444cc5ba05__ad6b1c6d-3eff-4ef9-bdf7-07da3103a779",
          "pStudentId": "a1853d0c-d1de-4f39-99b0-f5823819ee3b",
          "dStudentId": null,
          "side": "P",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        },
        {
          "assignmentName": "Bailiff",
          "assignmentKey": "51df203a-6a69-42a9-8f4f-84444cc5ba05__d1600b93-5d2f-4f55-85fa-1b8a267ae04c",
          "pStudentId": null,
          "dStudentId": "6ff75d80-cc12-4e87-a7c8-3c7156ef23b2",
          "side": "D",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        }
      ]
    },
    "d790eb4f-e460-4b48-870d-116615e96ae8": {
      "categoryName": "Team Score",
      "witnessId": null,
      "categoryAssignments": [
        {
          "assignmentName": "Team Score",
          "assignmentKey": "d790eb4f-e460-4b48-870d-116615e96ae8__b464686f-21c6-4703-90a7-36f65df2816e",
          "pStudentId": null,
          "dStudentId": null,
          "side": "BOTH",
          "minScore": 0,
          "maxScore": 10,
          "multiplier": 1
        }
      ]
    },
    "dee1099d-86b6-403b-b9e9-3e1216d38687": {
      "categoryName": "Point Deductions",
      "witnessId": null,
      "categoryAssignments": [
        {
          "assignmentName": "Deductions",
          "assignmentKey": "dee1099d-86b6-403b-b9e9-3e1216d38687__61023bc4-5096-41e8-9cd0-16e7bd7903ac",
          "pStudentId": null,
          "dStudentId": null,
          "side": "BOTH",
          "minScore": 0,
          "maxScore": 100,
          "multiplier": -1
        }
      ]
    }
  },
  "categoryOrder": [
    "dbd49fc5-ec98-4bc2-8e44-1114bb3e66b1",
    "b6c0506a-192b-44f4-bbbf-e6e62165672e",
    "2b475720-a356-4b38-ac93-acdabce77b01__3abef43c-66eb-48a5-be4b-d5d5338bf766",
    "2b475720-a356-4b38-ac93-acdabce77b01__89e7121b-dedd-4405-9cf7-0200a487077d",
    "7e64e4da-ce60-4221-8b96-13a8588678f5",
    "51df203a-6a69-42a9-8f4f-84444cc5ba05",
    "d790eb4f-e460-4b48-870d-116615e96ae8",
    "dee1099d-86b6-403b-b9e9-3e1216d38687"
  ],
  "awardCategories": {
    "1941384b-2549-4ad0-82db-d40d4bd07643": {
      "name": "Outstanding Attorney",
      "minNominees": 2,
      "maxNominees": 8,
      "eligibleStudentIds": [
        "05f425cd-b231-4c31-b97f-a92dc4219501",
        "caa9e181-5f2a-4b4e-8234-2997ef95c745",
        "4f39e987-840f-4597-9c67-4876110ecf42",
        "d1f7a099-4430-45d8-bd91-d12152f6322e"
      ]
    },
    "96d26395-bc64-4cd2-b726-a95d09ece2e9": {
      "name": "Outstanding Bailiff",
      "minNominees": 0,
      "maxNominees": 1,
      "eligibleStudentIds": [
        "6ff75d80-cc12-4e87-a7c8-3c7156ef23b2"
      ]
    },
    "2192d173-7dc1-48c0-a2c5-43e4cc8ae48b": {
      "name": "Outstanding Clerk",
      "minNominees": 0,
      "maxNominees": 1,
      "eligibleStudentIds": [
        "a1853d0c-d1de-4f39-99b0-f5823819ee3b"
      ]
    },
    "0e601dea-1c0f-454c-b852-9f626ce64403": {
      "name": "Outstanding Pretrial",
      "minNominees": 1,
      "maxNominees": 2,
      "eligibleStudentIds": [
        "05f425cd-b231-4c31-b97f-a92dc4219501",
        "4f39e987-840f-4597-9c67-4876110ecf42"
      ]
    },
    "d5332a8e-436d-40e5-b799-1aaafd3f038e": {
      "name": "Outstanding Witness",
      "minNominees": 1,
      "maxNominees": 8,
      "eligibleStudentIds": [
        "db41b8ad-8048-483d-80ab-674102a9e36d",
        "85cd96df-5347-4afd-858d-1af4bc4ed4f7"
      ]
    }
  },
  "roundLocked": true
}

describe('Score sheet page', () => {
  beforeEach(() => {
    cy.viewport(1280, 1000)

    // Match only the application's data request so the stub cannot replace
    // the document request made by cy.visit(URL).
    cy.intercept(
        {
          method: 'GET',
          url: `**/score/${SCORER_ID}`,
          resourceType: /xhr|fetch/,
        },
        {
          statusCode: 200,
          body: SCORE_SHEET_RESPONSE,
        },
    ).as('getScoreSheet')
  })

  const visitConflictCheck = () => {
    cy.visit(URL)
    cy.contains('h1', 'Before You Begin').should('be.visible')
  }

  const proceedToScoreSheet = () => {
    visitConflictCheck()
    cy.contains('button', 'Proceed').click()
    cy.contains('h1', 'Before You Begin').should('not.exist')
  }

  const fillAllScores = () => {
    cy.get('input.score-input:visible')
        .should('have.length', 18)
        .each(($input, index) => {
          cy.wrap($input).clear().type(String(7 + (index % 3)))
        })
  }

  const openAwardsModal = () => {
    proceedToScoreSheet()
    fillAllScores()
    cy.get('#score-submit-desktop').click()
    cy.get('[role="dialog"]').should('be.visible')
  }

  const selectNominee = (categoryName, studentName) => {
    cy.contains('.nomination-category', categoryName).within(() => {
      cy.contains('label.nomination-student', studentName)
          .find('input[type="checkbox"]')
          .check()
    })
  }

  const selectRequiredNominees = () => {
    selectNominee('Outstanding Attorney', 'Priya Shah')
    selectNominee('Outstanding Attorney', 'Elena Ruiz')
    selectNominee('Outstanding Pretrial', 'Priya Shah')
    selectNominee('Outstanding Witness', 'Noah Williams')
  }

  it('renders the conflict check screen first', () => {
    visitConflictCheck()
  })

  it('loads the score sheet for the assignment in the route', () => {
    cy.visit(URL)

    cy.wait('@getScoreSheet').then(({ request, response }) => {
      expect(request.url).to.include(`/score/${SCORER_ID}`)
      expect(response?.statusCode).to.equal(200)
      expect(response?.body).to.deep.equal(SCORE_SHEET_RESPONSE)
    })
  })

  it('displays scorer and trial details on conflict check', () => {
    visitConflictCheck()

    cy.contains('Dana Mitchell').should('be.visible')
    cy.contains('Hon. Elena Garcia').should('be.visible')
    cy.contains('Department 12').should('be.visible')
    cy.contains('P-101').should('be.visible')
    cy.contains('D-202').should('be.visible')
  })

  it('labels the teams as Prosecution and Defense for a criminal case', () => {
    visitConflictCheck()

    cy.contains('dt', 'Prosecution Team').should('be.visible')
    cy.contains('dt', 'Defense Team').should('be.visible')
  })

  it('has a Proceed button and a Report Conflict button', () => {
    visitConflictCheck()

    cy.contains('button', 'Proceed').should('be.visible')
    cy.contains('button', 'Report Conflict').should('be.visible')
  })

  it('advances to the score sheet after clicking Proceed', () => {
    proceedToScoreSheet()

    cy.contains('California Mock Trial Invitational').should('be.visible')
    cy.contains('People v. Jordan Blake').should('be.visible')
    cy.contains('P-101').should('be.visible')
    cy.contains('D-202').should('be.visible')
  })

  it('renders scoring categories in the configured order', () => {
    proceedToScoreSheet()

    const categoryNames = [
      'Pretrial',
      'Opening',
      'Witnesses',
      'Closing',
      'Clerk / Bailiff',
      'Team Score',
      'Point Deductions',
    ]

    cy.get('body').then(($body) => {
      const pageText = $body.text()
      const categoryPositions = categoryNames.map((name) => pageText.indexOf(name))

      categoryPositions.forEach((position) => {
        expect(position).to.be.greaterThan(-1)
      })
      expect(categoryPositions).to.deep.equal([...categoryPositions].sort((a, b) => a - b))
    })
  })

  it('shows witness characters and their assigned students', () => {
    proceedToScoreSheet()

    cy.contains('Dr. Riley Morgan').should('be.visible')
    cy.contains('Detective Cameron Brooks').should('be.visible')
    cy.contains('Noah Williams').should('be.visible')
    cy.contains('Liam Nguyen').should('be.visible')
  })

  it('shows attorney and courtroom-role assignments', () => {
    proceedToScoreSheet()

    const assignedStudentNames = [
      'Priya Shah',
      'Elena Ruiz',
      'Marcus Lee',
      'Maya Thompson',
      'Sofia Ramirez',
      'Avery Chen',
    ]

    assignedStudentNames.forEach((studentName) => {
      cy.contains(studentName).should('be.visible')
    })
  })

  it('rejects scores outside the configured range before opening the modal', () => {
    proceedToScoreSheet()

    cy.get('input.score-input:visible').first().type('11')
    cy.get('#score-submit-desktop').click()

    cy.get('[role="dialog"]').should('not.exist')
    cy.get('input.score-input:visible').first().should('have.attr', 'aria-invalid', 'true')
    cy.contains('[role="alert"]', 'Must be 0–10.').should('be.visible')
  })

  it('opens the awards and tiebreaker modal after valid scores are submitted', () => {
    openAwardsModal()

    cy.get('[role="dialog"]').within(() => {
      cy.contains('h2', 'Submit score sheet?').should('be.visible')
      cy.contains('Individual Award Nominations').should('be.visible')
      cy.contains('Outstanding Attorney').should('be.visible')
      cy.contains('Outstanding Bailiff').should('be.visible')
      cy.contains('Outstanding Clerk').should('be.visible')
      cy.contains('Outstanding Pretrial').should('be.visible')
      cy.contains('Outstanding Witness').should('be.visible')
      cy.contains('h3', 'Tiebreaker').should('be.visible')
      cy.contains('P-101').should('be.visible')
      cy.contains('D-202').should('be.visible')
      cy.get('#confirm-button').should('be.disabled')
      cy.contains('[role="alert"]', 'Please select the minimum number of nominees').should('be.visible')
      cy.contains('[role="alert"]', 'Please select a tiebreaker team.').should('be.visible')
    })

    cy.focused().should('have.attr', 'type', 'checkbox')
  })

  it('shows only eligible students in each award category', () => {
    openAwardsModal()

    const expectedNominees = {
      'Outstanding Attorney': ['Priya Shah', 'Elena Ruiz', 'Marcus Lee', 'Maya Thompson'],
      'Outstanding Bailiff': ['Avery Chen'],
      'Outstanding Clerk': ['Sofia Ramirez'],
      'Outstanding Pretrial': ['Priya Shah', 'Marcus Lee'],
      'Outstanding Witness': ['Noah Williams', 'Liam Nguyen'],
    }

    Object.entries(expectedNominees).forEach(([categoryName, studentNames]) => {
      cy.contains('.nomination-category', categoryName).within(() => {
        cy.get('input[type="checkbox"]').should('have.length', studentNames.length)
        studentNames.forEach((studentName) => {
          cy.contains(studentName).should('be.visible')
        })
      })
    })

    cy.contains('.nomination-category', 'Outstanding Attorney').within(() => {
      cy.contains('Priya Shah - P').should('be.visible')
      cy.contains('Marcus Lee - D').should('be.visible')
      cy.contains('Atty Direct - Dr. Riley Morgan').should('be.visible')
      cy.contains('Atty Cross - Detective Cameron Brooks').should('be.visible')
    })
  })

  it('ranks multiple nominees and allows their order to change', () => {
    openAwardsModal()
    selectNominee('Outstanding Attorney', 'Priya Shah')
    selectNominee('Outstanding Attorney', 'Elena Ruiz')

    cy.contains('.nomination-category', 'Outstanding Attorney').within(() => {
      cy.contains('(2/8, min 2)').should('be.visible')
      cy.get('.nomination-rank-name').eq(0).should('have.text', 'Priya Shah')
      cy.get('.nomination-rank-name').eq(1).should('have.text', 'Elena Ruiz')

      cy.contains('.nomination-rank-item', 'Priya Shah')
          .find('button[aria-label="Move down"]')
          .click()

      cy.get('.nomination-rank-name').eq(0).should('have.text', 'Elena Ruiz')
      cy.get('.nomination-rank-name').eq(1).should('have.text', 'Priya Shah')
    })
  })

  it('enables confirmation only after required awards and a tiebreaker are selected', () => {
    openAwardsModal()
    selectRequiredNominees()

    cy.get('#confirm-button').should('be.disabled')
    selectTiebreaker(SCORE_SHEET_RESPONSE.prosecutionId)

    cy.contains('[role="alert"]', 'Please select the minimum number of nominees').should('not.exist')
    cy.contains('[role="alert"]', 'Please select a tiebreaker team.').should('not.exist')

    cy.get('#confirm-button').should('be.enabled')
  })

  it('closes the modal with Escape or Cancel without clearing entered scores', () => {
    openAwardsModal()
    selectNominee('Outstanding Attorney', 'Priya Shah')
    selectTiebreaker(SCORE_SHEET_RESPONSE.prosecutionId)


    cy.get('body').type('{esc}')
    cy.get('[role="dialog"]').should('not.exist')
    cy.get('input.score-input:visible').first().should('have.value', '7')

    cy.get('#score-submit-desktop').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.get('[role="dialog"] input[type="checkbox"]:checked').should('not.exist')
    cy.get('[role="dialog"] input[name="tiebreaker"]:checked').should('not.exist')
    cy.get('[role="dialog"]').contains('button', 'Cancel').click()
    cy.get('[role="dialog"]').should('not.exist')
    cy.get('input.score-input:visible').first().should('have.value', '7')
  })

  it('submits scores, ranked nominations, tiebreaker, and layout', () => {
    cy.intercept('POST', `**/score/${SCORER_ID}/ballot`, {
      statusCode: 200,
      body: {},
    }).as('submitBallot')

    openAwardsModal()
    selectRequiredNominees()
    selectTiebreaker(SCORE_SHEET_RESPONSE.prosecutionId)

    cy.get('#confirm-button').click()

    const studentIdByName = Object.fromEntries(
        Object.entries(SCORE_SHEET_RESPONSE.students).map(([studentId, student]) => [student.name, studentId]),
    )
    const awardCategoryIdByName = Object.fromEntries(
        Object.entries(SCORE_SHEET_RESPONSE.awardCategories).map(([categoryId, category]) => [category.name, categoryId]),
    )

    cy.wait('@submitBallot').then(({ request }) => {
      const payload = request.body

      expect(payload.pairingID).to.equal(SCORE_SHEET_RESPONSE.pairingID)
      expect(payload.tiebreaker).to.equal(SCORE_SHEET_RESPONSE.prosecutionId)
      expect(payload.scores).to.have.length(18)
      expect(payload.layout).to.have.length(14)
      expect(payload.nominations).to.have.deep.members([
        {
          awardCategoryId: awardCategoryIdByName['Outstanding Attorney'],
          studentId: studentIdByName['Priya Shah'],
          rank: 1,
        },
        {
          awardCategoryId: awardCategoryIdByName['Outstanding Attorney'],
          studentId: studentIdByName['Elena Ruiz'],
          rank: 2,
        },
        {
          awardCategoryId: awardCategoryIdByName['Outstanding Pretrial'],
          studentId: studentIdByName['Priya Shah'],
          rank: 1,
        },
        {
          awardCategoryId: awardCategoryIdByName['Outstanding Witness'],
          studentId: studentIdByName['Noah Williams'],
          rank: 1,
        },
      ])
      const witnessLayout = payload.layout.find(
          (entry: {
            assignmentName: string
            witnessName: string | null
          }) =>
              entry.assignmentName === 'Witness' &&
              entry.witnessName === 'Dr. Riley Morgan',
      )

      expect(witnessLayout).to.exist
      expect(witnessLayout).to.deep.include({
        assignmentName: 'Witness',
        categoryName: 'Witnesses',
        witnessName: 'Dr. Riley Morgan',
        side: 'P',
        pStudentName: 'Noah Williams',
        dStudentName: null,
      })
    })

    const storageKey = `mock-trial-scores-${SCORE_SHEET_RESPONSE.pairingID}-${SCORER_ID}`
    cy.window().then((win) => {
      expect(win.localStorage.getItem(storageKey)).to.equal(null)
      expect(win.localStorage.getItem(`${storageKey}-category`)).to.equal(null)
    })
  })

  it('uses only known students in assignments and award eligibility', () => {
    const knownStudentIds = new Set(Object.keys(SCORE_SHEET_RESPONSE.students))

    Object.values(SCORE_SHEET_RESPONSE.scoringCategories).forEach((category) => {
      category.categoryAssignments.forEach(({ pStudentId, dStudentId }) => {
        const assignedStudentIds = [pStudentId, dStudentId]

        assignedStudentIds
            .filter((studentId) => studentId !== null)
            .forEach((studentId) => {
              expect(knownStudentIds.has(studentId)).to.equal(true)
            })
      })
    })

    Object.values(SCORE_SHEET_RESPONSE.awardCategories).forEach((category) => {
      category.eligibleStudentIds.forEach((studentId) => {
        expect(knownStudentIds.has(studentId)).to.equal(true)
      })
    })
  })

  it('does not show the main layout header', () => {
    cy.visit(URL)
    cy.get('header.site-header').should('not.exist')
  })

  it('shows NotFound for a route without a scorerID segment', () => {
    cy.visit('/score', { failOnStatusCode: false })
    cy.contains(/not found|404/i).should('be.visible')
  })
})
