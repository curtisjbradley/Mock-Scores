import "../styles/modal.css";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import type { ScorecardPayload } from '@mock-scores/shared';
import type { IScoreSheetFormat } from "../types.ts";
import type { Nominee, NomineeRanks, ScoreResults } from "./ScoreSheet.tsx";
import type {ScoreSection} from "@mock-scores/shared/src";

interface IConfirmSubmitModalProps {
    nominees: Nominee[];
    setNominees: (nominees: Nominee[]) => void;
    nomineeRanks: NomineeRanks;
    setNomineeRanks: Dispatch<SetStateAction<NomineeRanks>>;
    setShowConfirm: (confirm: boolean) => void;
    /** The raw form values captured at submit time. Used to build the structured payload. */
    pendingScores: ScoreResults | null;
    setPendingScores: (scores: ScoreResults | null) => void;
    /** localStorage key used to clear saved progress on successful submission. */
    storageKey: string;
    /** Whether the current user is a presiding judge (shows tiebreaker UI). */
    isPresider: boolean;
    /** Prosecution team code. */
    prosecution: string;
    /** Defense team code. */
    defense: string;
    /** "Prosecution" or "Plaintiff" depending on case type. */
    prosecutionLabel: string;
    /** Full scoresheet data, used to build the structured submission payload. */
    details: IScoreSheetFormat;
}

/** CSS selector string for all focusable elements, used for focus trapping. */
const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Confirmation modal shown before final scoresheet submission.
 * Handles nominee ranking, optional presider tiebreaker selection,
 * focus trapping, and Escape-to-close.
 * Builds a structured payload from raw form values before sending.
 */
const ConfirmSubmitModal = ({
    nominees, setNominees, nomineeRanks, setNomineeRanks,
    setShowConfirm, pendingScores, setPendingScores, storageKey,
    isPresider, prosecution, defense, prosecutionLabel, details,
}: IConfirmSubmitModalProps) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [tiebreaker, setTiebreaker] = useState<string>("");

    useEffect(() => {
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, []);

    /** Resets all confirmation state and closes the modal. */
    const reset = () => {
        setShowConfirm(false);
        setPendingScores(null);
        setNominees([]);
        setNomineeRanks({});
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
    }, [nominees]);

    const isRankingValid = useMemo(
        () => nominees.every((n) => nomineeRanks[n.id] != null),
        [nominees, nomineeRanks]
    );

    const isTiebreakerValid = !isPresider || tiebreaker !== "";

    /**
     * Transforms the flat `ScoreResults` form map into a structured array of score entries,
     * then submits the payload to the backend (TODO).
     * Each entry includes categoryId, assignmentKey, side, studentId, and score value.
     */
    const handleConfirm = () => {
        if (!pendingScores || !isRankingValid || !isTiebreakerValid) return;

        const scores : ScoreSection[]  = details.categoryOrder.flatMap((catId) => {
            const cat = details.scoringCategories[catId];
            return cat.categoryAssignments.flatMap((a) => {
                const entries = [];
                if (a.side !== "D" && a.pStudentId) {
                    const score = pendingScores[`${a.assignmentKey}P`];
                    if (typeof score === "number")
                        entries.push({ categoryId: catId, assignmentKey: a.assignmentKey, side: "P", studentId: a.pStudentId, score });
                }
                if (a.side !== "P" && a.dStudentId) {
                    const score = pendingScores[`${a.assignmentKey}D`];
                    if (typeof score === "number")
                        entries.push({ categoryId: catId, assignmentKey: a.assignmentKey, side: "D", studentId: a.dStudentId, score });
                }
                // Team score rows have no individual student
                if (a.side === "BOTH" && !a.pStudentId && !a.dStudentId) {
                    const pScore = pendingScores[`${a.assignmentKey}P`];
                    const dScore = pendingScores[`${a.assignmentKey}D`];
                    if (typeof pScore === "number") entries.push({ categoryId: catId, assignmentKey: a.assignmentKey, side: "P", studentId: null, score: pScore });
                    if (typeof dScore === "number") entries.push({ categoryId: catId, assignmentKey: a.assignmentKey, side: "D", studentId: null, score: dScore });
                }
                return entries;
            });
        }) as ScoreSection[];

        const payload: ScorecardPayload = {
            pairingID: details.trialID,
            scores,
            nominations: nominees.map((n) => ({ studentId: n.id, rank: nomineeRanks[n.id] })),
            ...(isPresider && { tiebreaker }),
        };

        // TODO: fetch(`/api/scoresheets/${details.trialID}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        console.log('Scorecard payload:', JSON.stringify(payload, null, 2));
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}-category`);
        reset();
    };

    const canConfirm = isRankingValid && isTiebreakerValid;

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

                {nominees.length > 0 && (
                    <div className="nominee-ranking">
                        <h3>Rank nominated students</h3>
                        <p>Lower numbers mean better performance. Duplicates are allowed.</p>
                        {nominees.map((nominee) => (
                            <div key={nominee.id} className="nominee-rank-row">
                                <div className="nominee-info">
                                    <strong>{nominee.name} <span className="nominee-side">({nominee.side})</span></strong>
                                    <div className="nominee-roles">
                                        {nominee.roles.map((role) => <div key={role}>{role}</div>)}
                                    </div>
                                </div>
                                <label className="sr-only" htmlFor={`rank-${nominee.id}`}>
                                    Rank for {nominee.name}
                                </label>
                                <select
                                    id={`rank-${nominee.id}`}
                                    className="rank-selection"
                                    value={nomineeRanks[nominee.id] ?? ""}
                                    onChange={(e) =>
                                        setNomineeRanks((cur) => ({ ...cur, [nominee.id]: Number(e.target.value) }))
                                    }
                                >
                                    <option value="" disabled>Select rank</option>
                                    {nominees.map((_, i) => (
                                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {nominees.length > 0 && !isRankingValid && (
                    <p className="ranking-error" role="alert">Please rank all nominated students.</p>
                )}

                {isPresider && (
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
                )}

                <div className="confirm-actions">
                    <button type="button" onClick={reset}>Cancel</button>
                    <button id="confirm-button" type="button" onClick={handleConfirm} disabled={!canConfirm}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmSubmitModal;
