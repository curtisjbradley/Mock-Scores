import "../styles/scoresheet.css";
import { useEffect, useRef, useState } from "react";
import {
    type FieldErrors,
    type SubmitHandler,
    useForm,
    useFormState,
    type UseFormRegister,
    type Control,
} from "react-hook-form";

import type { IScoreSheetFormat, IStudentInfo } from "../types.ts";
import ConfirmSubmitModal from "./ConfirmSubmitModal.tsx";

/** Flat map of form field IDs to their values. Scores are numbers; nomination checkboxes are booleans. */
export type ScoreResults = Record<string, number | boolean>;

/** Map of score field ID to the rank assigned to that nominee. */
export type NomineeRanks = Record<string, number>;

/** A student nominated for outstanding performance, with the roles they were nominated for. */
export type Nominee = {
    /** The student's ID from the `students` map. Used as a stable key for ranking. */
    id: string;
    /** Student's display name. */
    name: string;
    /** Which side the student performed on: "P" for prosecution/plaintiff, "D" for defense. */
    side: "P" | "D";
    /** List of role descriptions the student was nominated under. */
    roles: string[];
};

interface ScoreBoxProps {
    /** Unique form field ID for this score input. */
    id: string;
    /** Resolved student info, or null for team-score rows with no individual student. */
    student: IStudentInfo | null;
    register: UseFormRegister<ScoreResults>;
    control: Control<ScoreResults>;
    minScore: number;
    maxScore: number;
    submitAttempt: number;
}

/**
 * A single score input cell, including the student name, pronouns, and nomination checkbox.
 * Scrolls itself into view on focus to avoid being hidden behind the sticky nav on mobile.
 */
function ScoreBox({ id, student, register, control, minScore, maxScore, submitAttempt }: ScoreBoxProps) {
    const nominationId = `${id}student-nom`;
    const { errors } = useFormState({ control, name: id as keyof ScoreResults });
    const hasError = !!errors[id];
    const registered = register(id, {
        required: true,
        min: minScore,
        max: maxScore,
        valueAsNumber: true,
        validate: (v) => (typeof v === "number" && !isNaN(v) && v >= minScore && v <= maxScore) || `Must be ${minScore}–${maxScore}`,
    });

    return (
        <div className="score-box">
            <label className="sr-only" htmlFor={id}>
                Score for {student?.name ?? id}
            </label>
            <input
                className="score-input"
                id={id}
                type="number"
                inputMode="numeric"
                aria-invalid={hasError ? "true" : "false"}
                aria-describedby={hasError ? `${id}-error` : undefined}
                onWheel={(e) => e.currentTarget.blur()}
                {...registered}
            />
            {hasError && (
                <ScoreError id={id} minScore={minScore} maxScore={maxScore} submitAttempt={submitAttempt} />
            )}
            {student && (
                <p className="student-name">
                    {student.name}
                    {student.pronouns && <span className="student-pronouns"> ({student.pronouns})</span>}
                </p>
            )}
            {student && (
                <span className="student-nom">
                    <label className="student-name" htmlFor={nominationId}>Nominate:</label>
                    <input id={nominationId} type="checkbox" {...register(nominationId)} tabIndex={-1} />
                </span>
            )}
        </div>
    );
}

/** Inline validation error shown below a score input after a failed submit attempt. */
function ScoreError({ id, minScore, maxScore, submitAttempt }: {
    id: string; minScore: number; maxScore: number; submitAttempt: number;
}) {
    return (
        <span
            key={`${id}-${submitAttempt}`}
            id={`${id}-error`}
            className="error"
            role="alert"
            aria-live="assertive"
        >
            Must be {minScore}–{maxScore}.
        </span>
    );
}

/**
 * Builds the form field ID for a score input.
 * @param assignmentKey - The assignment's stable key.
 * @param side - "P" for prosecution, "D" for defense.
 */
function buildScoreId(assignmentKey: string, side: "P" | "D") {
    return `${assignmentKey}${side}`;
}

/**
 * Builds the form field ID for a nomination checkbox from its score field ID.
 * @param scoreId - The score input's field ID.
 */
function buildNominationId(scoreId: string) {
    return `${scoreId}student-nom`;
}

/**
 * The main scoresheet form. Renders all scoring categories in `categoryOrder` order,
 * with mobile step-through navigation and a desktop submit button.
 * Persists in-progress scores to localStorage keyed by tournamentID.
 */
function ScoreSheet(details: IScoreSheetFormat) {
    const storageKey = `mock-trial-scores-${details.trialID}-${details.scorerID}`;
    const categoryKey = `${storageKey}-category`;

    const [categoryIndex, setCategoryIndex] = useState(() => {
        const saved = localStorage.getItem(categoryKey);
        const parsed = saved !== null ? parseInt(saved, 10) : NaN;
        return !isNaN(parsed) && parsed < details.categoryOrder.length ? parsed : 0;
    });
    const [submitAttempt, setSubmitAttempt] = useState(0);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingScores, setPendingScores] = useState<ScoreResults | null>(null);
    const [nominees, setNominees] = useState<Nominee[]>([]);
    const [nomineeRanks, setNomineeRanks] = useState<NomineeRanks>({});

    const { register, handleSubmit, watch, reset, getValues, control } = useForm<ScoreResults>({ mode: "onBlur", reValidateMode: "onBlur" });

    const { categoryOrder, scoringCategories, witnesses } = details;
    const lastIndex = categoryOrder.length - 1;
    const prosecutionLabel = details.isCriminal ? "Prosecution" : "Plaintiff";

    /** Resolves a student ID to its info object, or null if the ID is null or not found. */
    const student = (id: string | null) => id ? (details.students[id] ?? null) : null;

    useEffect(() => {
        const savedScores = localStorage.getItem(storageKey);
        if (!savedScores) return;
        try { reset(JSON.parse(savedScores)); }
        catch { localStorage.removeItem(storageKey); }
    }, [reset, storageKey]);

    const storageKeyRef = useRef(storageKey);
    useEffect(() => { storageKeyRef.current = storageKey; }, [storageKey]);

    useEffect(() => {
        localStorage.setItem(categoryKey, String(categoryIndex));
    }, [categoryIndex, categoryKey]);

    useEffect(() => {
        const { unsubscribe } = watch(() => {
            localStorage.setItem(storageKeyRef.current, JSON.stringify(getValues()));
        });
        return unsubscribe;
    // watch and getValues are stable refs from useForm
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Collects all checked nomination checkboxes from the submitted scores
     * and returns a deduplicated list of nominees with their roles.
     */
    const getNominees = (scores: ScoreResults): Nominee[] => {
        const map = new Map<string, Nominee>();
        categoryOrder.forEach((catId) => {
            const cat = scoringCategories[catId];
            cat.categoryAssignments.forEach((a) => {
                const role = `${cat.categoryName} — ${a.assignmentName}`;
                const add = (scoreId: string, studentId: string, side: "P" | "D") => {
                    if (scores[buildNominationId(scoreId)] !== true) return;
                    const info = details.students[studentId];
                    if (!info) return;
                    const existing = map.get(studentId);
                    if (existing) { if (!existing.roles.includes(role)) existing.roles.push(role); return; }
                    map.set(studentId, { id: studentId, name: info.name, side, roles: [role] });
                };
                if (a.pStudentId) add(buildScoreId(a.assignmentKey, "P"), a.pStudentId, "P");
                if (a.dStudentId) add(buildScoreId(a.assignmentKey, "D"), a.dStudentId, "D");
            });
        });
        return Array.from(map.values());
    };

    const onSubmit: SubmitHandler<ScoreResults> = (scores) => {
        setPendingScores(scores);
        setNominees(getNominees(scores));
        setNomineeRanks({});
        setShowConfirm(true);
    };

    /** On validation failure, navigates to the category containing the first error and scrolls to it. */
    const onInvalid = (formErrors: FieldErrors<ScoreResults>) => {
        setSubmitAttempt((c) => c + 1);
        const errorIds = new Set(Object.keys(formErrors));
        let firstErrorId: string | undefined;
        let idx = -1;
        for (let i = 0; i < categoryOrder.length; i++) {
            const cat = scoringCategories[categoryOrder[i]];
            const found = cat.categoryAssignments.find((a) => {
                const pId = buildScoreId(a.assignmentKey, "P");
                const dId = buildScoreId(a.assignmentKey, "D");
                return errorIds.has(pId) || errorIds.has(dId);
            });
            if (found) {
                idx = i;
                const pId = buildScoreId(found.assignmentKey, "P");
                firstErrorId = errorIds.has(pId) ? pId : buildScoreId(found.assignmentKey, "D");
                break;
            }
        }
        if (idx === -1) return;
        setCategoryIndex(idx);
        window.requestAnimationFrame(() =>
            document.getElementById(firstErrorId!)?.scrollIntoView({ behavior: "smooth", block: "center" })
        );
    };

    const handlePrev = () => setCategoryIndex((c) => Math.max(0, c - 1));

    /** Advances to the next category and focuses the first score input in it. */
    const handleNext = () => {
        setCategoryIndex((c) => {
            const next = Math.min(lastIndex, c + 1);
            window.requestAnimationFrame(() => {
                document.querySelector<HTMLElement>(`#category-${next} .score-input`)?.focus();
            });
            return next;
        });
    };

    const isLastCategory = categoryIndex === lastIndex;

    return (
        <>
            <form
                id="scores"
                onSubmit={handleSubmit(onSubmit, onInvalid)}
                noValidate
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") e.preventDefault(); }}
            >
                <div className="trial-info-card">
                    <div className="trial-info-meta">
                        <span className="trial-info-courtroom">Courtroom {details.courtroomNumber}</span>
                        <span className="trial-info-presider">{details.presiderName}</span>
                    </div>
                    <h1 className="case-name">{details.caseName}</h1>
                    <div className="team-labels">
                        <div className="team-label team-label--prosecution">
                            <span className="team-code">{details.prosecution}</span>
                            <span className="team-label-role">{prosecutionLabel}</span>
                        </div>
                        <div className="team-label team-label--defense">
                            <span className="team-code team-code--defense">{details.defense}</span>
                            <span className="team-label-role">Defense</span>
                        </div>
                    </div>
                </div>

                <div className="score-container">
                    <table id="score-table">
                        <thead>
                            <tr className="scoresheet-header">
                                <th>Scoring Category</th>
                                <th>{prosecutionLabel}</th>
                                <th>Defense</th>
                            </tr>
                        </thead>
                        {categoryOrder.map((catId, index) => {
                            const cat = scoringCategories[catId];
                            const witness = cat.witnessId ? witnesses[cat.witnessId] : null;
                            const displayName = witness
                                ? `${cat.categoryName} — ${witness.characterName}`
                                : cat.categoryName;
                            return (
                                <tbody
                                    key={catId}
                                    className={index === categoryIndex ? "category-active" : "category-inactive"}
                                    id={`category-${index}`}
                                    aria-hidden={index !== categoryIndex}
                                >
                                    <tr className="category-name">
                                        <th colSpan={3}>{displayName}</th>
                                    </tr>
                                    {cat.categoryAssignments.map((assignment) => {
                                        const pId = buildScoreId(assignment.assignmentKey, "P");
                                        const dId = buildScoreId(assignment.assignmentKey, "D");
                                        return (
                                            <tr key={`${assignment.assignmentKey}-${assignment.side}`} className="score-row">
                                                <td>{assignment.assignmentName}</td>
                                                <td>
                                                    {assignment.side !== "D" && (
                                                        <ScoreBox id={pId} register={register} control={control} student={student(assignment.pStudentId)} minScore={assignment.minScore} maxScore={assignment.maxScore} submitAttempt={submitAttempt} />
                                                    )}
                                                </td>
                                                <td>
                                                    {assignment.side !== "P" && (
                                                        <ScoreBox id={dId} register={register} control={control} student={student(assignment.dStudentId)} minScore={assignment.minScore} maxScore={assignment.maxScore} submitAttempt={submitAttempt} />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            );
                        })}
                    </table>
                </div>

                <div className="scoresheet-footer">
                    <button type="submit" id="score-submit-desktop" aria-label="Submit scoresheet">
                        Submit Scoresheet
                    </button>
                </div>

                {/* Mobile step-through navigation — hidden on desktop via CSS */}
                <nav className="scoresheet-nav" aria-label="Scoresheet navigation">
                    <button type="button" disabled={categoryIndex <= 0} id="prev-button" className="nav-button" aria-label="Previous category" onClick={handlePrev}>
                        ← Previous
                    </button>
                    <span className="nav-progress" aria-live="polite" aria-atomic="true">
                        {categoryIndex + 1} / {categoryOrder.length}
                    </span>
                    <button type="button" disabled={isLastCategory} id="next-button" className="nav-button" aria-label="Next category" onClick={handleNext}>
                        Next →
                    </button>
                    <p className="nav-category-label" aria-hidden="true">
                        {(() => {
                            const cat = scoringCategories[categoryOrder[categoryIndex]];
                            const w = cat.witnessId ? witnesses[cat.witnessId] : null;
                            return w ? `${cat.categoryName} — ${w.characterName}` : cat.categoryName;
                        })()}
                    </p>
                    <button type="submit" id="score-submit" className={isLastCategory ? "submit-active" : "submit-inactive"} aria-label="Submit scoresheet">
                        Submit
                    </button>
                </nav>
            </form>

            {showConfirm && (
                <ConfirmSubmitModal
                    nominees={nominees}
                    setNominees={setNominees}
                    setShowConfirm={setShowConfirm}
                    setNomineeRanks={setNomineeRanks}
                    storageKey={storageKey}
                    setPendingScores={setPendingScores}
                    pendingScores={pendingScores}
                    nomineeRanks={nomineeRanks}
                    isPresider={details.isPresider}
                    prosecution={details.prosecution}
                    defense={details.defense}
                    prosecutionLabel={prosecutionLabel}
                    details={details}
                />
            )}
        </>
    );
}

export default ScoreSheet;
