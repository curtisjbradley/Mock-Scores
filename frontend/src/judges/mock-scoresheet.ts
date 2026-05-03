interface ITrialAssignment {
    assignmentName: string,
    assignmentKey: string,
    pStudentName: string | null,
    dStudentName: string | null,
    side: "D" | "P" | "BOTH"
    minScore: number,
    maxScore: number,
}

interface IScoringCategories {
    categoryName: string,
    categoryAssignments: ITrialAssignment[],
}


export interface IScoreSheetFormat {
    isCriminal: boolean,
    scoringCategories: IScoringCategories[],
    caseName: string,
    defense: string,
    prosecution: string
    tournamentID: string,
}


export const EXAMPLE_TRIAL_DETAILS: IScoreSheetFormat = {
    isCriminal: true,
    tournamentID: "6767",
    caseName: "People v Fromholz",
    defense: "Team 101",
    prosecution: "Team 103",
    scoringCategories: [
        {
            categoryName: "Pretrial",
            categoryAssignments: [
                {
                    dStudentName: "Santiago Baltodano",
                    pStudentName: null,
                    side: "D",
                    assignmentKey: "pretrial",
                    assignmentName: "Pretrial (D)",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Tristan Lardizabal",
                    dStudentName: null,
                    side: "P",
                    assignmentKey: "pretrial",
                    assignmentName: "Pretrial (P)",
                    minScore:0,
                    maxScore:10
                }
            ],
        },
        {
            categoryName: "Opening",
            categoryAssignments: [
                {
                    pStudentName: "Daniel McKenzie",
                    dStudentName: "Sophia Kuang",
                    side: "BOTH",
                    assignmentKey: "opening",
                    assignmentName: "Opening",
                    minScore:0,
                    maxScore:10
                }
            ]
        }, {
        categoryName: "P Witness 1 - Rio Sacks",
            categoryAssignments: [
                {
                    pStudentName: "Daniel McKenzie",
                    dStudentName: null,

                    side: "P",
                    assignmentKey: "p-witness-1-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Charly Eslston",
                    pStudentName: null,
                    side: "D",
                    assignmentKey: "p-witness-cross-1",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Emilie Mehlschau",
                    side: "P",
                    assignmentKey: "p-witness-1",
                    assignmentName: "Witness Performance",
                    dStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        },
        {
            categoryName: "P Witness 2 - Sam Longo",
            categoryAssignments: [
                {
                    pStudentName: "Alastor Bronson",
                    dStudentName: null,

                    side: "P",
                    assignmentKey: "p-witness-2-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Sophia Bates",
                    pStudentName: null,
                    side: "D",
                    assignmentKey: "p-witness-cross-2",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Kai Masny",
                    side: "P",
                    assignmentKey: "p-witness-2",
                    assignmentName: "Witness Performance",
                    dStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        },
        {
            categoryName: "P Witness 3 - Imari Rodriguez",
            categoryAssignments: [
                {
                    pStudentName: "Alastor Bronson",
                    dStudentName: null,

                    side: "P",
                    assignmentKey: "p-witness-3-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Sophia Kuang",
                    pStudentName: null,
                    side: "D",
                    assignmentKey: "p-witness-cross-3",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Aspen Brown",
                    side: "P",
                    assignmentKey: "p-witness-3",
                    assignmentName: "Witness Performance",
                    dStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        },
        {
            categoryName: "P Witness 4 - Alden Mitchell",
            categoryAssignments: [
                {
                    pStudentName: "Natalia Gonzalez",
                    dStudentName: null,

                    side: "P",
                    assignmentKey: "p-witness-4-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Charly Eslston",
                    pStudentName: null,
                    side: "D",
                    assignmentKey: "p-witness-cross-4",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Sean Oksner",
                    side: "P",
                    assignmentKey: "p-witness-4",
                    assignmentName: "Witness Performance",
                    dStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        },
        {
            categoryName: "D Witness 1 - Dr  Ren Dunne",
            categoryAssignments: [
                {
                    pStudentName: null,
                    dStudentName: "Sophia Bates",

                    side: "D",
                    assignmentKey: "d-witness-1-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Natalia Gonzalez",
                    dStudentName: null,
                    side: "P",
                    assignmentKey: "d-witness-cross-1",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Diya Menon",
                    side: "D",
                    assignmentKey: "d-witness-1",
                    assignmentName: "Witness Performance",
                    pStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        },{
            categoryName: "D Witness 2 - Jean Kronstadt",
            categoryAssignments: [
                {
                    pStudentName: null,
                    dStudentName: "Charly Elston",

                    side: "D",
                    assignmentKey: "d-witness-2-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Daniel McKenzie",
                    dStudentName: null,
                    side: "P",
                    assignmentKey: "d-witness-cross-2",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Violet Van Gundy",
                    side: "D",
                    assignmentKey: "d-witness-2",
                    assignmentName: "Witness Performance",
                    pStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        },
        {
            categoryName: "D Witness 3 - Haley Fromholz",
            categoryAssignments: [
                {
                    pStudentName: null,
                    dStudentName: "Charly Elston",

                    side: "D",
                    assignmentKey: "d-witness-3-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Daniel McKenzie",
                    dStudentName: null,
                    side: "P",
                    assignmentKey: "d-witness-cross-3",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Bidu Ashley",
                    side: "D",
                    assignmentKey: "d-witness-3",
                    assignmentName: "Witness Performance",
                    pStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        }, {
            categoryName: "D Witness 4 - Takoda Morrison",
            categoryAssignments: [
                {
                    pStudentName: null,
                    dStudentName: "Sophia Kuang",

                    side: "D",
                    assignmentKey: "d-witness-4-direct",
                    assignmentName: "Direct / Re Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: "Alastor Bronson",
                    dStudentName: null,
                    side: "P",
                    assignmentKey: "d-witness-cross-4",
                    assignmentName: "Cross Exam by Attorney",
                    minScore:0,
                    maxScore:10
                },
                {
                    dStudentName: "Ella McManama",
                    side: "D",
                    assignmentKey: "d-witness-4",
                    assignmentName: "Witness Performance",
                    pStudentName: null,
                    minScore:0,
                    maxScore:10
                },
            ]
        },
        {
            categoryName: "Clerk / Bailiff",
            categoryAssignments: [
                {
                    pStudentName: "Cole Allen",
                    dStudentName: null,
                    side: "P",
                    assignmentKey: "clerk",
                    assignmentName: "Clerk",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: null,
                    dStudentName: "Phoebe Cross",
                    side: "D",
                    assignmentKey: "bailiff",
                    assignmentName: "Bailiff",
                    minScore:0,
                    maxScore:10
                }
            ]
        },
        {
            categoryName: "Closing Argument",
            categoryAssignments: [
                {
                    pStudentName: "Natalia Gonzalez",
                    dStudentName: null,
                    side: "P",
                    assignmentKey: "closing",
                    assignmentName: "Closing (P)",
                    minScore:0,
                    maxScore:10
                },
                {
                    pStudentName: null,
                    dStudentName: "Sophia Bates",
                    side: "D",
                    assignmentKey: "closing",
                    assignmentName: "Closing (D)",
                    minScore:0,
                    maxScore:10
                }
            ],
        },
        {
            categoryName: "Team Score",
            categoryAssignments: [
                {
                    pStudentName: null,
                    dStudentName: null,
                    side: "BOTH",
                    assignmentKey: "team-score",
                    assignmentName: "Participation and Team Performance",
                    minScore:0,
                    maxScore:10
                }
            ]
        }

    ]
}
