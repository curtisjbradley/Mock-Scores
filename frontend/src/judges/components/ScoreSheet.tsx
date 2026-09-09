import "../styles/scoresheet.css";
import {useEffect, useState} from "react";
import {
    type Control,
    type FieldErrors,
    get,
    type SubmitHandler,
    useForm,
    type UseFormRegister,
    useFormState,
} from "react-hook-form";

import type {IScoreSheetFormat, IStudentInfo,} from "@mock-scores/shared";

import ConfirmSubmitModal from "./ConfirmSubmitModal.tsx";

/**
 * Flat map of score field IDs to numeric values.
 */
export type ScoreResults = Record<string, number>;


/**
 * Builds the form field ID for a score input.
 */
function buildScoreId(
    assignmentKey: string,
    side: "P" | "D",
): string {
    return `${assignmentKey}${side}`;
}


/**
 * Only keep valid finite numeric values when persisting/restoring scores.
 *
 * This prevents NaN, null, malformed localStorage data, etc. from being
 * restored into the form.
 */
function sanitizeScores(value: unknown): ScoreResults {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        return {};
    }

    const scores: ScoreResults = {};

    for (const [key, score] of Object.entries(value)) {
        if (
            typeof score === "number" &&
            Number.isFinite(score)
        ) {
            scores[key] = score;
        }
    }

    return scores;
}


interface ScoreBoxProps {
    /** Unique form field ID for this score input. */
    id: string;

    /** Student associated with this score, if applicable. */
    student: IStudentInfo | null;

    register: UseFormRegister<ScoreResults>;
    control: Control<ScoreResults>;

    minScore: number;
    maxScore: number;

    /**
     * Incremented on every failed submit so persistent errors can
     * be re-announced to assistive technology.
     */
    submitAttempt: number;
}


/**
 * A single score input.
 */
function ScoreBox({
                      id,
                      student,
                      register,
                      control,
                      minScore,
                      maxScore,
                      submitAttempt,
                  }: ScoreBoxProps) {
    /*
     * Subscribe only to this exact field's error state rather than
     * causing every ScoreBox to react to every form-state update.
     */
    const {errors} = useFormState({
        control,
        name: id,
        exact: true,
    });

    /*
     * React Hook Form field names may be paths, so use get()
     * rather than directly indexing errors[id].
     *
     * Your current UUID-style IDs are safe either way, but get()
     * makes this robust if the ID format ever changes.
     */
    const fieldError = get(errors, id);
    const hasError = !!fieldError;

    const errorMessage =
        typeof fieldError?.message === "string"
            ? fieldError.message
            : `Must be ${minScore}–${maxScore}.`;

    /*
     * One validation rule is the source of truth.
     *
     * valueAsNumber turns an empty number input into NaN, which
     * Number.isFinite() handles correctly.
     */
    const registered = register(id, {
        valueAsNumber: true,

        validate: (value) => {
            if (
                !Number.isFinite(value) ||
                value < minScore ||
                value > maxScore
            ) {
                return `Must be ${minScore}–${maxScore}.`;
            }

            return true;
        },
    });

    return (
        <div className="score-box">
            <label
                className="sr-only"
                htmlFor={id}
            >
                Score for {student?.name ?? id}
            </label>

            <input
                {...registered}
                id={id}
                className="score-input"
                type="number"
                inputMode="numeric"
                min={minScore}
                max={maxScore}
                aria-invalid={hasError}
                aria-describedby={
                    hasError
                        ? `${id}-error`
                        : undefined
                }
                onWheel={(event) => {
                    event.currentTarget.blur();
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                    }
                }}
            />
            {hasError && (
                <ScoreError
                    key={`${id}-${submitAttempt}`}
                    id={id}
                    message={errorMessage}
                />
            )}

            {student && (
                <p className="student-name">
                    {student.name}

                    {student.pronouns && (
                        <span className="student-pronouns">
                            {" "}
                            ({student.pronouns})
                        </span>
                    )}
                </p>
            )}
        </div>
    );
}


interface ScoreErrorProps {
    id: string;
    message: string;
}


/**
 * Inline score validation message.
 */
function ScoreError({
                        id,
                        message,
                    }: ScoreErrorProps) {
    return (
        <span
            id={`${id}-error`}
            className="error"
            role="alert"
        >
            {message}
        </span>
    );
}


/**
 * Main scoresheet.
 */
function ScoreSheet(
    details: IScoreSheetFormat & {
        onSubmitSuccess: () => void;
    },
) {
    const storageKey =
        `mock-trial-scores-${details.pairingID}-${details.scorer.scorerID}`;

    const categoryKey =
        `${storageKey}-category`;

    const {
        categoryOrder,
        scoringCategories,
        witnesses,
    } = details;

    const lastIndex = categoryOrder.length - 1;

    const prosecutionLabel =
        details.isCriminal
            ? "Prosecution"
            : "Plaintiff";


    /*
     * Restore the last category when constructing the component.
     */
    const [categoryIndex, setCategoryIndex] = useState(() => {
        const saved =
            localStorage.getItem(categoryKey);

        if (saved === null) {
            return 0;
        }

        const parsed =
            Number.parseInt(saved, 10);

        if (
            !Number.isInteger(parsed) ||
            parsed < 0 ||
            parsed >= categoryOrder.length
        ) {
            return 0;
        }

        return parsed;
    });


    /*
     * Used to cause an existing error alert to be remounted after
     * another failed submission.
     */
    const [submitAttempt, setSubmitAttempt] =
        useState(0);


    /*
     * We don't attempt to focus the invalid field until React has
     * committed the category change.
     */
    const [
        pendingErrorId,
        setPendingErrorId,
    ] = useState<string | null>(null);


    const [
        showConfirm,
        setShowConfirm,
    ] = useState(false);


    const [
        pendingScores,
        setPendingScores,
    ] = useState<ScoreResults | null>(null);


    const {
        register,
        handleSubmit,
        reset,
        control,
        setFocus,
        subscribe,
    } = useForm<ScoreResults>({
        mode: "onBlur",
        reValidateMode: "onChange",
        shouldFocusError: false,
    });


    /**
     * Resolve student information.
     */
    const student = (
        id: string | null,
    ): IStudentInfo | null => {
        if (!id) {
            return null;
        }

        return details.students[id] ?? null;
    };


    /*
     * Restore saved scores.
     */
    useEffect(() => {
        const stored =
            localStorage.getItem(storageKey);

        if (!stored) {
            return;
        }

        try {
            const parsed = JSON.parse(stored);

            reset(
                sanitizeScores(parsed),
            );
        } catch {
            localStorage.removeItem(storageKey);
        }
    }, [
        reset,
        storageKey,
    ]);


    /*
     * Persist the currently selected category.
     */
    useEffect(() => {
        localStorage.setItem(
            categoryKey,
            String(categoryIndex),
        );
    }, [
        categoryIndex,
        categoryKey,
    ]);


    /*
     * Persist scores whenever a form value changes.
     *
     * The subscription is recreated automatically if storageKey
     * changes and properly cleaned up on unmount.
     */
    useEffect(() => {
        return subscribe({
            formState: {
                values: true,
            },

            callback: ({values}) => {
                const scores = sanitizeScores(values);

                localStorage.setItem(
                    storageKey,
                    JSON.stringify(scores),
                );
            },
        });
    }, [
        subscribe,
        storageKey,
    ]);


    /*
     * Focus and scroll only after categoryIndex has been committed
     * by React.
     *
     * This removes the race between setCategoryIndex() and trying
     * to focus an element inside the newly active category.
     */
    useEffect(() => {
        if (!pendingErrorId) {
            return;
        }

        const frame =
            window.requestAnimationFrame(() => {
                setFocus(pendingErrorId);

                document
                    .getElementById(pendingErrorId)
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });

                setPendingErrorId(null);
            });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [
        categoryIndex,
        pendingErrorId,
        setFocus,
    ]);


    /**
     * Valid submission.
     */
    const onSubmit: SubmitHandler<ScoreResults> = (
        scores,
    ) => {
        setPendingScores(scores);
        setShowConfirm(true);
    };


    /**
     * Invalid submission.
     *
     * Find the first invalid field according to the score sheet's
     * category/assignment order rather than depending on object-key
     * ordering from React Hook Form.
     */
    const onInvalid = (
        formErrors: FieldErrors<ScoreResults>,
    ) => {
        setSubmitAttempt(
            (current) => current + 1,
        );

        for (
            let categoryIdx = 0;
            categoryIdx < categoryOrder.length;
            categoryIdx++
        ) {
            const category =
                scoringCategories[
                    categoryOrder[categoryIdx]
                    ];

            for (
                const assignment
                of category.categoryAssignments
                ) {
                const pId =
                    buildScoreId(
                        assignment.assignmentKey,
                        "P",
                    );

                const dId =
                    buildScoreId(
                        assignment.assignmentKey,
                        "D",
                    );


                /*
                 * Only check fields that actually exist for this
                 * assignment's side.
                 */
                if (
                    assignment.side !== "D" &&
                    get(formErrors, pId)
                ) {
                    setPendingErrorId(pId);
                    setCategoryIndex(categoryIdx);
                    return;
                }


                if (
                    assignment.side !== "P" &&
                    get(formErrors, dId)
                ) {
                    setPendingErrorId(dId);
                    setCategoryIndex(categoryIdx);
                    return;
                }
            }
        }
    };


    const handlePrev = () => {
        setCategoryIndex(
            (current) =>
                Math.max(
                    0,
                    current - 1,
                ),
        );
    };


    /**
     * Advance to the next category.
     */
    const handleNext = () => {
        setCategoryIndex(
            (current) =>
                Math.min(
                    lastIndex,
                    current + 1,
                ),
        );
    };


    const isLastCategory =
        categoryIndex === lastIndex;


    return (
        <>
            <form
                id="scores"
                onSubmit={handleSubmit(
                    onSubmit,
                    onInvalid,
                )}
                noValidate
                autoComplete="off"
            >
                <div className="trial-info-card">
                    <div className="trial-info-meta">
                        <span className="trial-info-courtroom">
                            Courtroom{" "}
                            {details.courtroomNumber}
                        </span>

                        <span className="trial-info-presider">
                            {details.presiderName}
                        </span>
                    </div>

                    <h1 className="tournament-name">
                        {details.tournamentName}
                    </h1>

                    <h2 className="case-name">
                        {details.caseName}
                    </h2>

                    <div className="team-labels">
                        <div className="team-label team-label--prosecution">
                            <span className="team-code">
                                {details.prosecutionCode}
                            </span>

                            <span className="team-label-role">
                                {prosecutionLabel}
                            </span>
                        </div>

                        <div className="team-label team-label--defense">
                            <span className="team-code team-code--defense">
                                {details.defenseCode}
                            </span>

                            <span className="team-label-role">
                                Defense
                            </span>
                        </div>
                    </div>
                </div>


                <div className="score-container">
                    <table id="score-table">
                        <thead>
                        <tr className="scoresheet-header">
                            <th>
                                Scoring Category
                            </th>

                            <th>
                                {prosecutionLabel}
                            </th>

                            <th>
                                Defense
                            </th>
                        </tr>
                        </thead>


                        {categoryOrder.map(
                            (catId, index) => {
                                const category =
                                    scoringCategories[catId];

                                const witness =
                                    category.witnessId
                                        ? witnesses[
                                            category.witnessId
                                            ]
                                        : null;

                                const displayName =
                                    witness
                                        ? `${category.categoryName} — ${witness.characterName}`
                                        : category.categoryName;


                                return (
                                    <tbody
                                        key={catId}
                                        id={`category-${index}`}
                                        className={
                                            index === categoryIndex
                                                ? "category-active"
                                                : "category-inactive"
                                        }
                                        aria-hidden={
                                            index !== categoryIndex
                                        }
                                    >
                                    <tr className="category-name">
                                        <th colSpan={3}>
                                            {displayName}
                                        </th>
                                    </tr>


                                    {category.categoryAssignments.map(
                                        (assignment) => {
                                            const pId =
                                                buildScoreId(
                                                    assignment.assignmentKey,
                                                    "P",
                                                );

                                            const dId =
                                                buildScoreId(
                                                    assignment.assignmentKey,
                                                    "D",
                                                );


                                            return (
                                                <tr
                                                    key={
                                                        `${assignment.assignmentKey}-${assignment.side}`
                                                    }
                                                    className="score-row"
                                                >
                                                    <td>
                                                        {
                                                            assignment.assignmentName
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            assignment.side !== "D" && (
                                                                <ScoreBox
                                                                    id={pId}
                                                                    register={register}
                                                                    control={control}
                                                                    student={
                                                                        student(
                                                                            assignment.pStudentId,
                                                                        )
                                                                    }
                                                                    minScore={
                                                                        assignment.minScore
                                                                    }
                                                                    maxScore={
                                                                        assignment.maxScore
                                                                    }
                                                                    submitAttempt={
                                                                        submitAttempt
                                                                    }
                                                                />
                                                            )
                                                        }
                                                    </td>

                                                    <td>
                                                        {
                                                            assignment.side !== "P" && (
                                                                <ScoreBox
                                                                    id={dId}
                                                                    register={register}
                                                                    control={control}
                                                                    student={
                                                                        student(
                                                                            assignment.dStudentId,
                                                                        )
                                                                    }
                                                                    minScore={
                                                                        assignment.minScore
                                                                    }
                                                                    maxScore={
                                                                        assignment.maxScore
                                                                    }
                                                                    submitAttempt={
                                                                        submitAttempt
                                                                    }
                                                                />
                                                            )
                                                        }
                                                    </td>
                                                </tr>
                                            );
                                        },
                                    )}
                                    </tbody>
                                );
                            },
                        )}
                    </table>
                </div>


                <div className="scoresheet-footer">
                    <button
                        type="submit"
                        id="score-submit-desktop"
                        aria-label="Submit scoresheet"
                    >
                        Submit Scoresheet
                    </button>
                </div>


                <nav
                    className="scoresheet-nav"
                    aria-label="Scoresheet navigation"
                >
                    <button
                        type="button"
                        id="prev-button"
                        className="nav-button"
                        aria-label="Previous category"
                        disabled={categoryIndex <= 0}
                        onClick={handlePrev}
                    >
                        ← Previous
                    </button>


                    <span
                        className="nav-progress"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {categoryIndex + 1}
                        {" / "}
                        {categoryOrder.length}
                    </span>


                    <button
                        type="button"
                        id="next-button"
                        className="nav-button"
                        aria-label="Next category"
                        disabled={isLastCategory}
                        onClick={handleNext}
                    >
                        Next →
                    </button>


                    <p
                        className="nav-category-label"
                        aria-hidden="true"
                    >
                        {(() => {
                            const category =
                                scoringCategories[
                                    categoryOrder[
                                        categoryIndex
                                        ]
                                    ];

                            const witness =
                                category.witnessId
                                    ? witnesses[
                                        category.witnessId
                                        ]
                                    : null;

                            return witness
                                ? `${category.categoryName} - ${witness.characterName}`
                                : category.categoryName;
                        })()}
                    </p>


                    <button
                        type="submit"
                        id="score-submit"
                        className={
                            isLastCategory
                                ? "submit-active"
                                : "submit-inactive"
                        }
                        aria-label="Submit scoresheet"
                    >
                        Submit
                    </button>
                </nav>
            </form>


            {showConfirm && (
                <ConfirmSubmitModal
                    setShowConfirm={setShowConfirm}
                    storageKey={storageKey}
                    setPendingScores={
                        setPendingScores
                    }
                    pendingScores={
                        pendingScores
                    }
                    prosecution={
                        details.prosecutionCode
                    }
                    defense={
                        details.defenseCode
                    }
                    prosecutionLabel={
                        prosecutionLabel
                    }
                    details={details}
                    onSubmitSuccess={
                        details.onSubmitSuccess
                    }
                    defense_id={
                        details.defenseId
                    }
                    prosecution_id={
                        details.prosecutionId
                    }
                    showTiebreaker={
                        details.ballotOptions
                            .showTiebreaker
                    }
                />
            )}
        </>
    );
}


export default ScoreSheet;