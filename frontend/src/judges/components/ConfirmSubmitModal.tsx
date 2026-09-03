import { API_BASE } from '../../config';
import "../styles/modal.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ScorecardPayload, IScoreSheetFormat, IAwardCategoryInfo } from '@mock-scores/shared';
import type { ScoreResults } from "./ScoreSheet.tsx";
import type { ScoreSection } from "@mock-scores/shared";

interface IConfirmSubmitModalProps {
    setShowConfirm: (confirm: boolean) => void;
    /** The raw form values captured at submit time. Used to build the structured payload. */
    pendingScores: ScoreResults | null;
    setPendingScores: (scores: ScoreResults | null) => void;
    /** localStorage key used to clear saved progress on successful submission. */
    storageKey: string;
    /** Prosecution team code. */
    prosecution: string;
    /** Defense team code. */
    defense: string;
    /** "Prosecution" or "Plaintiff" depending on case type. */
    prosecutionLabel: string;
    /** Full scoresheet data, used to build the structured submission payload. */
    details: IScoreSheetFormat;
    /** Called after a successful submission so the parent can show the submitted state. */
    onSubmitSuccess: () => void;
}

/** CSS selector string for all focusable elements, used for focus trapping. */
const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Per-category nomination selections: categoryId → array of selected studentIds */
type NominationSelections = Record<string, string[]>;

/**
 * Confirmation modal shown before final scoresheet submission.
 * Handles award category nominations, optional presider tiebreaker selection,
 * focus trapping, and Escape-to-close.
 */
const ConfirmSubmitModal = ({
    setShowConfirm, pendingScores, setPendingScores, storageKey, prosecution, defense, prosecutionLabel, details, onSubmitSuccess,
}: IConfirmSubmitModalProps) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [tiebreaker, setTiebreaker] = useState<string>("");
    const [nominations, setNominations] = useState<NominationSelections>({});

    const awardCategories = useMemo(() => details.awardCategories ?? {}, [details.awardCategories]);
    const hasAwardCategories = Object.keys(awardCategories).length > 0;

    useEffect(() => {
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, []);

    /** Resets all confirmation state and closes the modal. */
    const reset = () => {
        setShowConfirm(false);
        setPendingScores(null);
        setNominations({});
        setTiebreaker("");
    };

    // Focus trap + Escape to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { reset(); return; }
            if (e.key !== "Tab") return;
            const dialog = dialogRef.current;
            if (!dialog) return;
            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (!focusable.length) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleNominee = (categoryId: string, studentId: string, maxNominees: number) => {
        setNominations(prev => {
            const current = prev[categoryId] ?? [];
            if (current.includes(studentId)) {
                return { ...prev, [categoryId]: current.filter(id => id !== studentId) };
            }
            if (current.length >= maxNominees) return prev; // at max
            return { ...prev, [categoryId]: [...current, studentId] };
        });
    };

    const reorderNominee = (categoryId: string, fromIndex: number, toIndex: number) => {
        setNominations(prev => {
            const current = [...(prev[categoryId] ?? [])];
            const [moved] = current.splice(fromIndex, 1);
            current.splice(toIndex, 0, moved);
            return { ...prev, [categoryId]: current };
        });
    };

    const isNominationsValid = useMemo(() => {
        for (const [catId, catInfo] of Object.entries(awardCategories)) {
            const selected = nominations[catId] ?? [];
            const eligible = catInfo.eligibleStudentIds.length;
            // If fewer eligible students than min, all must be selected
            // Otherwise, at least minNominees must be selected
            const required = Math.min(catInfo.minNominees, eligible);
            if (eligible > 0 && selected.length < required) {
                return false;
            }
        }
        return true;
    }, [awardCategories, nominations]);

    const isTiebreakerValid = tiebreaker !== "";

    /**
     * Transforms the flat `ScoreResults` form map into a structured array of score entries,
     * then POSTs the payload to /score/:assignmentId/ballot.
     * After successful ballot submission, submits nominations separately.
     */
    const handleConfirm = async () => {
        if (!pendingScores || !isNominationsValid || !isTiebreakerValid || submitting) return;

        const scores: ScoreSection[] = details.categoryOrder.flatMap((catId) => {
            const cat = details.scoringCategories[catId];
            return cat.categoryAssignments.flatMap((a) => {
                const entries = [];
                if (a.side !== "D") {
                    const score = pendingScores[`${a.assignmentKey}P`];
                    if (typeof score === "number")
                        entries.push({ categoryId: catId, assignmentKey: a.assignmentKey, side: "P", studentId: a.pStudentId ?? null, score });
                }
                if (a.side !== "P") {
                    const score = pendingScores[`${a.assignmentKey}D`];
                    if (typeof score === "number")
                        entries.push({ categoryId: catId, assignmentKey: a.assignmentKey, side: "D", studentId: a.dStudentId ?? null, score });
                }
                return entries;
            });
        }) as ScoreSection[];

        // Build nominations in the new format: { awardCategoryId, studentId, rank }
        const nominationPayload = Object.entries(nominations).flatMap(([catId, studentIds]) =>
            studentIds.map((studentId, idx) => ({ awardCategoryId: catId, studentId, rank: idx + 1 }))
        );

        // Snapshot the segment layout so combined/tabulated views can render this
        // ballot deterministically even if the template's IDs later drift.
        const layout = details.categoryOrder.flatMap((catId) => {
            const cat = details.scoringCategories[catId];
            const witnessName = cat.witnessId ? details.witnesses[cat.witnessId]?.characterName ?? null : null;
            return cat.categoryAssignments.map((a) => ({
                assignmentKey: a.assignmentKey,
                assignmentName: a.assignmentName,
                categoryName: cat.categoryName,
                witnessName,
                side: a.side,
                pStudentName: a.pStudentId ? details.students[a.pStudentId]?.name ?? null : null,
                dStudentName: a.dStudentId ? details.students[a.dStudentId]?.name ?? null : null,
            }));
        });

        const payload: ScorecardPayload = {
            pairingID: details.pairingID,
            scores,
            nominations: nominationPayload,
            tiebreaker: tiebreaker,
            layout,
        };

        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`${API_BASE}/score/${details.scorer.scorerID}/ballot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.status === 409) {
                setSubmitError('This ballot has already been submitted.');
                setSubmitting(false);
                return;
            }
            if (!res.ok) {
                setSubmitError('Something went wrong. Please try again.');
                setSubmitting(false);
                return;
            }
        } catch {
            setSubmitError('Network error. Please check your connection and try again.');
            setSubmitting(false);
            return;
        }

        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}-category`);
        onSubmitSuccess();
    };

    const canConfirm = isNominationsValid && isTiebreakerValid && !submitting;

    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onClick={(e) => { if (e.target === e.currentTarget) reset(); }}
        >
            <div
                ref={dialogRef}
                className="confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-desc"
            >
                <h2 id="confirm-title">Submit score sheet?</h2>
                <p id="confirm-desc">Please confirm your scores. This cannot be undone.</p>

                {hasAwardCategories && (
                    <div className="nominee-ranking">
                        <h3>Individual Award Nominations</h3>
                        <p>Select students for each award category.</p>
                        {Object.entries(awardCategories).map(([catId, catInfo]) => (
                            <NominationCategory
                                key={catId}
                                categoryId={catId}
                                category={catInfo}
                                students={details.students}
                                selected={nominations[catId] ?? []}
                                onToggle={(studentId) => toggleNominee(catId, studentId, catInfo.maxNominees)}
                                onReorder={reorderNominee}
                            />
                        ))}
                    </div>
                )}

                {hasAwardCategories && !isNominationsValid && (
                    <p className="ranking-error" role="alert">Please select the minimum number of nominees for each category.</p>
                )}

                {
                    <div className="tiebreaker-section">
                        <h3>Tiebreaker</h3>
                        <p>If the scores are tied, which team wins?</p>
                        <div className="tiebreaker-options">
                            <label className={`tiebreaker-option${tiebreaker === prosecution ? " tiebreaker-option--selected" : ""}`}>
                                <input type="radio" name="tiebreaker" value={prosecution} checked={tiebreaker === prosecution} onChange={(e) => setTiebreaker(e.target.value)} />
                                <span className="tiebreaker-code">{prosecution}</span>
                                <span className="tiebreaker-role">{prosecutionLabel}</span>
                            </label>
                            <label className={`tiebreaker-option${tiebreaker === defense ? " tiebreaker-option--selected" : ""}`}>
                                <input type="radio" name="tiebreaker" value={defense} checked={tiebreaker === defense} onChange={(e) => setTiebreaker(e.target.value)} />
                                <span className="tiebreaker-code">{defense}</span>
                                <span className="tiebreaker-role">Defense</span>
                            </label>
                        </div>
                        {!isTiebreakerValid && (
                            <p className="ranking-error" role="alert">Please select a tiebreaker team.</p>
                        )}
                    </div>
                }

                <div className="confirm-actions">
                    <button type="button" onClick={reset} disabled={submitting}>Cancel</button>
                    <button id="confirm-button" type="button" onClick={handleConfirm} disabled={!canConfirm || submitting}>
                        {submitting ? 'Submitting…' : 'Confirm'}
                    </button>
                </div>
                {submitError && (
                    <p className="ranking-error" role="alert">{submitError}</p>
                )}
            </div>
        </div>
    );
};

/** Renders a single award category with selection checkboxes and ordered ranking. */
function NominationCategory({ categoryId, category, students, selected, onToggle, onReorder }: {
    categoryId: string;
    category: IAwardCategoryInfo;
    students: Record<string, { name: string; pronouns: string | null; schoolId: string }>;
    selected: string[];
    onToggle: (studentId: string) => void;
    onReorder: (categoryId: string, fromIndex: number, toIndex: number) => void;
}) {
    const atMax = selected.length >= category.maxNominees;
    const eligible = category.eligibleStudentIds.length;
    const required = Math.min(category.minNominees, eligible);

    return (
        <div className="nomination-category">
            <h4 className="nomination-category-name">
                {category.name}
                <span className="nomination-category-count">
                    {' '}({selected.length}/{category.maxNominees}{required > 0 ? `, min ${required}` : ''})
                </span>
            </h4>

            {/* Selection checkboxes for eligible students */}
            <div className="nomination-students">
                {category.eligibleStudentIds.map(studentId => {
                    const info = students[studentId];
                    if (!info) return null;
                    const isSelected = selected.includes(studentId);
                    const disabled = !isSelected && atMax;
                    return (
                        <label key={studentId} className={`nomination-student${isSelected ? ' nomination-student--selected' : ''}${disabled ? ' nomination-student--disabled' : ''}`}>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={disabled}
                                onChange={() => onToggle(studentId)}
                            />
                            <span>{info.name}</span>
                            {info.pronouns && <span className="student-pronouns"> ({info.pronouns})</span>}
                        </label>
                    );
                })}
                {category.eligibleStudentIds.length === 0 && (
                    <p className="nomination-empty">No eligible students for this category.</p>
                )}
            </div>

            {/* Ordered ranking list — only shown when students are selected */}
            {selected.length > 1 && (
                <div className="nomination-ranking-list">
                    <p className="nomination-ranking-hint">Drag or use arrows to rank. #1 = best.</p>
                    {selected.map((studentId, idx) => {
                        const info = students[studentId];
                        if (!info) return null;
                        return (
                            <div key={studentId} className="nomination-rank-item">
                                <span className="nomination-rank-number">{idx + 1}</span>
                                <span className="nomination-rank-name">{info.name}</span>
                                <div className="nomination-rank-arrows">
                                    <button type="button" disabled={idx === 0} onClick={() => onReorder(categoryId, idx, idx - 1)} aria-label="Move up">↑</button>
                                    <button type="button" disabled={idx === selected.length - 1} onClick={() => onReorder(categoryId, idx, idx + 1)} aria-label="Move down">↓</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ConfirmSubmitModal;
