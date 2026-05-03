import "./scoresheet.css";
import { useEffect, useState} from "react";
import {
    type FieldErrors,
    type SubmitHandler,
    useForm,
    type UseFormRegister,
} from "react-hook-form";

import type {IScoreSheetFormat} from "./mock-scoresheet.ts";
import ConfirmSubmitModal from "./ConfirmSubmitModal.tsx";

export type ScoreResults = Record<string, number | boolean>;
export type NomineeRanks = Record<string, number>;

const STORAGE_KEY = "mock-trial-scores";

export type Nominee = {
    id: string;
    name: string;
    roles: string[];
};

interface ScoreBoxProps {
    id: string;
    studentName: string | null;
    register: UseFormRegister<ScoreResults>;
    minScore: number;
    maxScore: number;
    hasError?: boolean;
}

function ScoreBox({
                      id,
                      studentName,
                      register,
                      minScore,
                      maxScore,
                      hasError = false,
                  }: ScoreBoxProps) {
    const nominationId = `${id}student-nom`;

    const ensureVisible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();

        const isVisible =
            rect.top >= 80 && // space for sticky header
            rect.bottom <= window.innerHeight - 80; // space for nav

        if (!isVisible) {
            el.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    };

    return (
        <div className="score-box">
            <label className="sr-only" htmlFor={id}>
                Score for {studentName ?? id}
            </label>

            <input
                className="score-input"
                id={id}
                type="number"
                aria-invalid={hasError ? "true" : "false"}
                aria-describedby={hasError ? `${id}-error` : undefined}
                onWheel={(e) => e.currentTarget.blur()}
                {...register(id, {
                    required: true,
                    min: minScore,
                    max: maxScore,
                    valueAsNumber: true,
                })}
                onFocus={(e) => ensureVisible(e.currentTarget)}
            />

            {studentName && <p className="student-name">{studentName}</p>}

            {studentName && (
                <span className="student-nom">
          <label className="student-name" htmlFor={nominationId}>
            Nominate:
          </label>

          <input id={nominationId} type="checkbox" {...register(nominationId)} tabIndex={-1} />
        </span>
            )}
        </div>
    );
}

function ScoreError({
                        id,
                        minScore,
                        maxScore,
                        submitAttempt,
                    }: {
    id: string;
    minScore: number;
    maxScore: number;
    submitAttempt: number;
}) {
    return (
        <span
            key={`${id}-${submitAttempt}`}
            id={`${id}-error`}
            className="error"
            role="alert"
            aria-live="assertive"
        >
      Invalid score. Must be between {minScore} and {maxScore}.
    </span>
    );
}

function buildScoreId(assignmentKey: string, side: "P" | "D") {
    return `${assignmentKey}${side}`;
}

function buildNominationId(scoreId: string) {
    return `${scoreId}student-nom`;
}

function ScoreSheetDetails(details: IScoreSheetFormat) {
    const [category, setCategory] = useState(0);
    const [submitAttempt, setSubmitAttempt] = useState(0);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingScores, setPendingScores] = useState<ScoreResults | null>(null);
    const [nominees, setNominees] = useState<Nominee[]>([]);
    const [nomineeRanks, setNomineeRanks] = useState<NomineeRanks>({});

    const {
        register,
        handleSubmit,
        formState: {errors},
        watch,
        reset,
    } = useForm<ScoreResults>();

    const storageKey = `${STORAGE_KEY}-${details.tournamentID}`;
    const lastCategoryIndex = details.scoringCategories.length - 1;
    const prosecutionLabel = details.isCriminal ? "Prosecution" : "Plaintiff";


    useEffect(() => {
        const savedScores = localStorage.getItem(storageKey);

        if (!savedScores) return;

        try {
            reset(JSON.parse(savedScores));
        } catch {
            localStorage.removeItem(storageKey);
        }
    }, [reset, storageKey]);

    useEffect(() => {
        const subscription = watch((values) => {
            localStorage.setItem(storageKey, JSON.stringify(values));
        });

        return () => subscription.unsubscribe();
    }, [watch, storageKey]);


    const getNominatedNames = (scores: ScoreResults) => {
        const nominatedNames = new Set<string>();

        details.scoringCategories.forEach((categoryGroup) => {
            categoryGroup.categoryAssignments.forEach((assignment) => {
                const prosecutionId = buildScoreId(assignment.assignmentKey, "P");
                const defenseId = buildScoreId(assignment.assignmentKey, "D");

                if (
                    assignment.pStudentName &&
                    scores[buildNominationId(prosecutionId)] === true
                ) {
                    nominatedNames.add(assignment.pStudentName);
                }

                if (
                    assignment.dStudentName &&
                    scores[buildNominationId(defenseId)] === true
                ) {
                    nominatedNames.add(assignment.dStudentName);
                }
            });
        });

        return nominatedNames;
    };

    const getNominees = (scores: ScoreResults): Nominee[] => {
        const nominatedNames = getNominatedNames(scores);
        const nomineeMap = new Map<string, Nominee>();

        details.scoringCategories.forEach((categoryGroup) => {
            categoryGroup.categoryAssignments.forEach((assignment) => {
                const role = `${categoryGroup.categoryName} - ${assignment.assignmentName}`;

                const addNomineeRole = (id: string, name: string) => {
                    if (!nominatedNames.has(name)) return;

                    const nominee = nomineeMap.get(name);

                    if (nominee) {
                        if (!nominee.roles.includes(role)) {
                            nominee.roles.push(role);
                        }

                        return;
                    }

                    nomineeMap.set(name, {
                        id,
                        name,
                        roles: [role],
                    });
                };

                if (assignment.pStudentName) {
                    addNomineeRole(
                        buildScoreId(assignment.assignmentKey, "P"),
                        assignment.pStudentName
                    );
                }

                if (assignment.dStudentName) {
                    addNomineeRole(
                        buildScoreId(assignment.assignmentKey, "D"),
                        assignment.dStudentName
                    );
                }
            });
        });

        return Array.from(nomineeMap.values());
    };




    const onSubmit: SubmitHandler<ScoreResults> = (scores) => {
        setPendingScores(scores);
        setNominees(getNominees(scores));
        setNomineeRanks({});
        setShowConfirm(true);
    };


    const onInvalid = (formErrors: FieldErrors<ScoreResults>) => {
        setSubmitAttempt((count) => count + 1);

        const firstErrorId = Object.keys(formErrors)[0];
        const firstErrorCategoryIndex = details.scoringCategories.findIndex(
            (categoryGroup) =>
                categoryGroup.categoryAssignments.some((assignment) => {
                    const prosecutionId = buildScoreId(assignment.assignmentKey, "P");
                    const defenseId = buildScoreId(assignment.assignmentKey, "D");

                    return firstErrorId === prosecutionId || firstErrorId === defenseId;
                })
        );

        if (firstErrorCategoryIndex === -1) return;

        setCategory(firstErrorCategoryIndex);

        window.requestAnimationFrame(() => {
            document.getElementById(firstErrorId)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        });
    };

    const handlePrev = () => {
        setCategory((current) => Math.max(0, current - 1));
    };

    const handleNext = () => {
        setCategory((current) => Math.min(lastCategoryIndex, current + 1));
    };


    return (
        <>
            <form
                id="scores"
                onSubmit={handleSubmit(onSubmit, onInvalid)}
                noValidate
                autoComplete="off"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                    }
                }}
            >
                <div className="score-container">
                    <table id="score-table">
                        <colgroup>
                            <col style={{width: "40%"}}/>
                            <col style={{width: "30%"}}/>
                            <col style={{width: "30%"}}/>
                        </colgroup>

                        <thead>
                        <tr className="scoresheet-header">
                            <th>Scoring Category</th>
                            <th>{prosecutionLabel}</th>
                            <th>Defense</th>
                        </tr>
                        </thead>

                        {details.scoringCategories.map((categoryGroup, index) => (
                            <tbody
                                key={categoryGroup.categoryName}
                                className={
                                    index === category ? "category-active" : "category-inactive"
                                }
                                id={`category-${index}`}
                            >
                            <tr className="category-name">
                                <th colSpan={3}>{categoryGroup.categoryName}</th>
                            </tr>

                            {categoryGroup.categoryAssignments.map((assignment) => {
                                const prosecutionId = buildScoreId(
                                    assignment.assignmentKey,
                                    "P"
                                );
                                const defenseId = buildScoreId(assignment.assignmentKey, "D");

                                const prosecutionError = errors[prosecutionId];
                                const defenseError = errors[defenseId];

                                return (
                                    <tr
                                        key={`${assignment.assignmentKey}-${assignment.side}`}
                                        className="score-row"
                                    >
                                        <td>{assignment.assignmentName}</td>

                                        <td>
                                            {assignment.side !== "D" && (
                                                <>
                                                    <ScoreBox
                                                        id={prosecutionId}
                                                        register={register}
                                                        studentName={assignment.pStudentName}
                                                        minScore={assignment.minScore}
                                                        maxScore={assignment.maxScore}
                                                        hasError={!!prosecutionError}
                                                    />

                                                    {prosecutionError && (
                                                        <ScoreError
                                                            id={prosecutionId}
                                                            minScore={assignment.minScore}
                                                            maxScore={assignment.maxScore}
                                                            submitAttempt={submitAttempt}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </td>

                                        <td>
                                            {assignment.side !== "P" && (
                                                <>
                                                    <ScoreBox
                                                        id={defenseId}
                                                        register={register}
                                                        studentName={assignment.dStudentName}
                                                        minScore={assignment.minScore}
                                                        maxScore={assignment.maxScore}
                                                        hasError={!!defenseError}
                                                    />

                                                    {defenseError && (
                                                        <ScoreError
                                                            id={defenseId}
                                                            minScore={assignment.minScore}
                                                            maxScore={assignment.maxScore}
                                                            submitAttempt={submitAttempt}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        ))}
                    </table>
                </div>

                <div className="scoresheet-nav">
                    <button
                        type="button"
                        disabled={category <= 0}
                        id="prev-button"
                        className="nav-button"
                        onClick={handlePrev}
                    >
                        Prev
                    </button>

                    <button
                        type="button"
                        disabled={category >= lastCategoryIndex}
                        id="next-button"
                        className="nav-button"
                        onClick={handleNext}
                    >
                        Next
                    </button>

                    <button
                        type="submit"
                        className={
                            category === lastCategoryIndex ? "submit-active" : "submit-inactive"
                        }
                        id="score-submit"
                    >
                        Submit
                    </button>
                </div>
            </form>

            {showConfirm && <ConfirmSubmitModal nominees={nominees} setNominees={setNominees} setShowConfirm={setShowConfirm } setNomineeRanks={setNomineeRanks} storageKey={storageKey} setPendingScores={setPendingScores} pendingScores={pendingScores}nomineeRanks={nomineeRanks}/>}
        </>
    );
}

export default ScoreSheetDetails;