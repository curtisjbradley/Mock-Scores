import "../styles/modal.css";
import "../styles/scoresheet.css";
import { useState } from "react";
import type { IScoreSheetFormat } from "@mock-scores/shared";

interface TiebreakerOnlyProps {
    /** Full scoresheet data. Scoring categories are shown as a read-only roster. */
    details: IScoreSheetFormat;
    /** localStorage key used to clear saved progress on successful submission. */
    storageKey: string;
    /** Called after a successful submission so the parent can show the submitted state. */
    onSubmitSuccess: () => void;
}

/**
 * View for presiders who do not score but must submit a tiebreaker.
 * Shows a read-only roster of all assignments and students so the presider
 * can identify who is performing, then presents the tiebreaker selection.
 * Requires confirmation before final submission.
 */
function TiebreakerOnly({ details, storageKey, onSubmitSuccess }: TiebreakerOnlyProps) {
    const [tiebreaker, setTiebreaker] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const prosecutionLabel = details.isCriminal ? "Prosecution" : "Plaintiff";
    /** Resolves a student ID to its info object, or null. */
    const student = (id: string | null) => id ? (details.students[id] ?? null) : null;
    const { categoryOrder, scoringCategories, witnesses } = details;

    const handleSubmit = async () => {
        if (!tiebreaker || submitting) return;

        const payload = {
            pairingID: details.pairingID,
            scores: [],
            nominations: [],
            tiebreaker,
        };

        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`/api/score/${details.scorer.scorerID}/ballot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.status === 409) {
                setSubmitError('This ballot has already been submitted.');
                setSubmitting(false);
                setConfirming(false);
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
        onSubmitSuccess();
    };

    if (submitError && !confirming) {
        return (
            <div className="conflict-check">
                <div className="conflict-card">
                    <h1 className="conflict-title">Error</h1>
                    <p style={{ color: "var(--text-muted)" }}>{submitError}</p>
                    <div className="conflict-actions">
                        <button type="button" className="conflict-btn-proceed" onClick={() => setSubmitError(null)}>
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="scores">
            <div className="trial-info-card">
                <div className="trial-info-meta">
                    <span className="trial-info-courtroom">Courtroom {details.courtroomNumber}</span>
                    <span className="trial-info-presider">{details.presiderName}</span>
                </div>
                <h1 className="case-name">{details.caseName}</h1>
                <div className="team-labels">
                    <div className="team-label team-label--prosecution">
                        <span className="team-code">{details.prosecutionCode}</span>
                        <span className="team-label-role">{prosecutionLabel}</span>
                    </div>
                    <div className="team-label team-label--defense">
                        <span className="team-code team-code--defense">{details.defenseCode}</span>
                        <span className="team-label-role">Defense</span>
                    </div>
                </div>
            </div>

            {/* Read-only roster — presiders see names/pronouns but do not score */}
            <div className="score-container">
                <table id="score-table">
                    <thead>
                        <tr className="scoresheet-header">
                            <th>Role</th>
                            <th>{prosecutionLabel}</th>
                            <th>Defense</th>
                        </tr>
                    </thead>
                    {categoryOrder.map((catId) => {
                        const group = scoringCategories[catId];
                        const witness = group.witnessId ? witnesses[group.witnessId] : null;
                        const displayName = witness ? `${group.categoryName} — ${witness.characterName}` : group.categoryName;
                        return (
                            <tbody key={catId}>
                                <tr className="category-name">
                                    <th colSpan={3}>{displayName}</th>
                                </tr>
                                {group.categoryAssignments.map((a) => {
                                    const p = student(a.pStudentId);
                                    const d = student(a.dStudentId);
                                    return (
                                        <tr key={`${a.assignmentKey}-${a.side}`} className="score-row">
                                            <td>{a.assignmentName}</td>
                                            <td>
                                                {p && (
                                                    <p className="student-name">
                                                        {p.name}
                                                        {p.pronouns && <span className="student-pronouns"> ({p.pronouns})</span>}
                                                    </p>
                                                )}
                                            </td>
                                            <td>
                                                {d && (
                                                    <p className="student-name">
                                                        {d.name}
                                                        {d.pronouns && <span className="student-pronouns"> ({d.pronouns})</span>}
                                                    </p>
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

            <div className="scoresheet-footer" style={{ flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                <div className="tiebreaker-options">
                    <label className={`tiebreaker-option${tiebreaker === details.prosecutionCode ? " tiebreaker-option--selected" : ""}`}>
                        <input type="radio" name="tiebreaker" value={details.prosecutionCode} checked={tiebreaker === details.prosecutionCode} onChange={(e) => setTiebreaker(e.target.value)} />
                        <span className="tiebreaker-code">{details.prosecutionCode}</span>
                        <span className="tiebreaker-role">{prosecutionLabel}</span>
                    </label>
                    <label className={`tiebreaker-option${tiebreaker === details.defenseCode ? " tiebreaker-option--selected" : ""}`}>
                        <input type="radio" name="tiebreaker" value={details.defenseCode} checked={tiebreaker === details.defenseCode} onChange={(e) => setTiebreaker(e.target.value)} />
                        <span className="tiebreaker-code">{details.defenseCode}</span>
                        <span className="tiebreaker-role">Defense</span>
                    </label>
                </div>
                <button type="button" id="score-submit-desktop" disabled={!tiebreaker} onClick={() => setConfirming(true)}>
                    Submit Tiebreaker
                </button>
            </div>

            {confirming && (
                <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}>
                    <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="tb-confirm-title">
                        <h2 id="tb-confirm-title">Submit tiebreaker?</h2>
                        <p>You selected team <strong>{tiebreaker} — {tiebreaker === details.prosecutionCode ? prosecutionLabel : "Defense"}</strong>. This cannot be undone.</p>
                        {submitError && (
                            <p className="ranking-error" role="alert">{submitError}</p>
                        )}
                        <div className="confirm-actions">
                            <button type="button" onClick={() => setConfirming(false)} disabled={submitting}>Cancel</button>
                            <button type="button" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? 'Submitting…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TiebreakerOnly;
