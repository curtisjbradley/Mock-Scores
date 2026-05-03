import type { IScoreSheetFormat } from "./types.ts";

export const EXAMPLE_TRIAL_DETAILS: IScoreSheetFormat = {
    isCriminal: true,
    isPresider: true,
    presiderTiebreakerOnly: false,
    tournamentID: "6767",
    trialID: "55",
    caseName: "People v Fromholz",
    scorerName: "Bary Allen",
    scorerID: "s10",
    presiderName: "John Doe",
    courtroomNumber: "Department 10",
    defense: "101",
    prosecution: "103",

    students: {
        "s1":  { name: "Santiago Baltodano", pronouns: "he/him",  schoolId: "101" },
        "s2":  { name: "Tristan Lardizabal", pronouns: "he/him",  schoolId: "103" },
        "s3":  { name: "Daniel McKenzie",    pronouns: "he/him",  schoolId: "103" },
        "s4":  { name: "Sophia Kuang",       pronouns: "she/her", schoolId: "101" },
        "s6":  { name: "Emilie Mehlschau",   pronouns: "she/her", schoolId: "103" },
        "s7":  { name: "Alastor Bronson",    pronouns: "he/him",  schoolId: "103" },
        "s8":  { name: "Sophia Bates",       pronouns: "she/her", schoolId: "101" },
        "s9":  { name: "Kai Masny",          pronouns: "she/her", schoolId: "103" },
        "s10": { name: "Aspen Brown",        pronouns: "she/her", schoolId: "103" },
        "s11": { name: "Natalia Gonzalez",   pronouns: "she/her", schoolId: "103" },
        "s12": { name: "Sean Oksner",        pronouns: "he/him",  schoolId: "103" },
        "s13": { name: "Diya Menon",         pronouns: "she/her", schoolId: "101" },
        "s14": { name: "Charly Elston",      pronouns: "she/her", schoolId: "101" },
        "s15": { name: "Violet Van Gundy",   pronouns: "she/her", schoolId: "101" },
        "s16": { name: "Bidu Ashley",        pronouns: "he/him",  schoolId: "101" },
        "s17": { name: "Ella McManama",      pronouns: "she/her", schoolId: "101" },
        "s18": { name: "Cole Allen",         pronouns: "he/him",  schoolId: "103" },
        "s19": { name: "Phoebe Cross",       pronouns: "she/her", schoolId: "101" },
    },

    witnesses: {
        "w1": { characterName: "Rio Sacks" },
        "w2": { characterName: "Sam Longo" },
        "w3": { characterName: "Imari Rodriguez" },
        "w4": { characterName: "Alden Mitchell" },
        "w5": { characterName: "Dr Ren Dunne" },
        "w6": { characterName: "Jean Kronstadt" },
        "w7": { characterName: "Haley Fromholz" },
        "w8": { characterName: "Takoda Morrison" },
    },

    categoryOrder: [
        "pretrial", "opening",
        "p-witness-1", "p-witness-2", "p-witness-3", "p-witness-4",
        "d-witness-1", "d-witness-2", "d-witness-3", "d-witness-4",
        "clerk-bailiff", "closing", "team-score",
    ],

    scoringCategories: {
        "pretrial": {
            categoryName: "Pretrial", witnessId: null,
            categoryAssignments: [
                { dStudentId: "s1",  pStudentId: null, side: "D", assignmentKey: "pretrial-d", assignmentName: "Pretrial (D)", minScore: 0, maxScore: 10 },
                { pStudentId: "s2",  dStudentId: null, side: "P", assignmentKey: "pretrial-p", assignmentName: "Pretrial (P)", minScore: 0, maxScore: 10 },
            ],
        },
        "opening": {
            categoryName: "Opening", witnessId: null,
            categoryAssignments: [
                { pStudentId: "s3", dStudentId: "s4", side: "BOTH", assignmentKey: "opening", assignmentName: "Opening", minScore: 0, maxScore: 10 },
            ],
        },
        "p-witness-1": {
            categoryName: "P Witness 1", witnessId: "w1",
            categoryAssignments: [
                { pStudentId: "s3",  dStudentId: null,  side: "P", assignmentKey: "p-w1-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { dStudentId: "s14", pStudentId: null,  side: "D", assignmentKey: "p-w1-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { pStudentId: "s6",  dStudentId: null,  side: "P", assignmentKey: "p-w1-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "p-witness-2": {
            categoryName: "P Witness 2", witnessId: "w2",
            categoryAssignments: [
                { pStudentId: "s7",  dStudentId: null, side: "P", assignmentKey: "p-w2-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { dStudentId: "s8",  pStudentId: null, side: "D", assignmentKey: "p-w2-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { pStudentId: "s9",  dStudentId: null, side: "P", assignmentKey: "p-w2-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "p-witness-3": {
            categoryName: "P Witness 3", witnessId: "w3",
            categoryAssignments: [
                { pStudentId: "s7",  dStudentId: null, side: "P", assignmentKey: "p-w3-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { dStudentId: "s4",  pStudentId: null, side: "D", assignmentKey: "p-w3-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { pStudentId: "s10", dStudentId: null, side: "P", assignmentKey: "p-w3-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "p-witness-4": {
            categoryName: "P Witness 4", witnessId: "w4",
            categoryAssignments: [
                { pStudentId: "s11", dStudentId: null,  side: "P", assignmentKey: "p-w4-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { dStudentId: "s14", pStudentId: null,  side: "D", assignmentKey: "p-w4-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { pStudentId: "s12", dStudentId: null,  side: "P", assignmentKey: "p-w4-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "d-witness-1": {
            categoryName: "D Witness 1", witnessId: "w5",
            categoryAssignments: [
                { dStudentId: "s8",  pStudentId: null,  side: "D", assignmentKey: "d-w1-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { pStudentId: "s11", dStudentId: null,  side: "P", assignmentKey: "d-w1-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { dStudentId: "s13", pStudentId: null,  side: "D", assignmentKey: "d-w1-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "d-witness-2": {
            categoryName: "D Witness 2", witnessId: "w6",
            categoryAssignments: [
                { dStudentId: "s14", pStudentId: null, side: "D", assignmentKey: "d-w2-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { pStudentId: "s3",  dStudentId: null, side: "P", assignmentKey: "d-w2-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { dStudentId: "s15", pStudentId: null, side: "D", assignmentKey: "d-w2-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "d-witness-3": {
            categoryName: "D Witness 3", witnessId: "w7",
            categoryAssignments: [
                { dStudentId: "s14", pStudentId: null, side: "D", assignmentKey: "d-w3-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { pStudentId: "s3",  dStudentId: null, side: "P", assignmentKey: "d-w3-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { dStudentId: "s16", pStudentId: null, side: "D", assignmentKey: "d-w3-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "d-witness-4": {
            categoryName: "D Witness 4", witnessId: "w8",
            categoryAssignments: [
                { dStudentId: "s4",  pStudentId: null, side: "D", assignmentKey: "d-w4-direct",  assignmentName: "Direct / Re Exam by Attorney", minScore: 0, maxScore: 10 },
                { pStudentId: "s7",  dStudentId: null, side: "P", assignmentKey: "d-w4-cross",   assignmentName: "Cross Exam by Attorney",        minScore: 0, maxScore: 10 },
                { dStudentId: "s17", pStudentId: null, side: "D", assignmentKey: "d-w4-witness", assignmentName: "Witness Performance",           minScore: 0, maxScore: 10 },
            ],
        },
        "clerk-bailiff": {
            categoryName: "Clerk / Bailiff", witnessId: null,
            categoryAssignments: [
                { pStudentId: "s18", dStudentId: null, side: "P", assignmentKey: "clerk",   assignmentName: "Clerk",   minScore: 0, maxScore: 10 },
                { dStudentId: "s19", pStudentId: null, side: "D", assignmentKey: "bailiff", assignmentName: "Bailiff", minScore: 0, maxScore: 10 },
            ],
        },
        "closing": {
            categoryName: "Closing Argument", witnessId: null,
            categoryAssignments: [
                { pStudentId: "s11", dStudentId: null, side: "P", assignmentKey: "closing-p", assignmentName: "Closing (P)", minScore: 0, maxScore: 10 },
                { dStudentId: "s8",  pStudentId: null, side: "D", assignmentKey: "closing-d", assignmentName: "Closing (D)", minScore: 0, maxScore: 10 },
            ],
        },
        "team-score": {
            categoryName: "Team Score", witnessId: null,
            categoryAssignments: [
                { pStudentId: null, dStudentId: null, side: "BOTH", assignmentKey: "team-score", assignmentName: "Participation and Team Performance", minScore: 0, maxScore: 10 },
            ],
        },
    },
};
