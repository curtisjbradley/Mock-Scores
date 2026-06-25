import "../styles/modal.css";
import "../styles/scoresheet.css";
import { useState } from "react";
import type { IScoreSheetFormat } from "@mock-scores/shared";

interface TiebreakerOnlyProps {
    /** Full scoresheet data. Scoring categories are shown as a read-only roster. */
    details: IScoreSheetFormat;
    /** localStorage key used to clear saved progress on successful submission. */
    storageKey: string;
}

/**
 * View for presiders who do not score but must submit a tiebreaker.
 * Shows a read-only roster of all assignments and students so the presider
 * can identify who is performing, then presents the tiebreaker selection.
 * Requires confirmation before final submission.
 */
function TiebreakerOnly({ details, storageKey }: TiebreakerOnlyProps) {
    const [tiebreaker, setTiebreaker] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const prosecutionLabel = details.isCriminal ? "Prosecution" : "Plaintiff";
    /** Resolves a student ID to its info object, or null. */
    const student = (id: string | null) => id ? (details.students[id] ?? null) : null;
    const { categoryOrder, scoringCategories, witnesses } = details;

    const handleSubmit = () => {
        if (!tiebreaker) return;
        // TODO: POST /api/pairings/:pairingId/tiebreaker { scorerID, tiebreaker }
        localStorage.removeItem(storageKey);
        setSubmitted(true);
        setConfirming(false);
    };

    if (submitted) {
        return (
            <div className="conflict-check">
                <div className="conflict-card">
                    <h1 className="conflict-title">Submitted</h1>
                    <p style={{ color: "var(--text-muted)" }}>Your tiebreaker selection has been recorded.</p>
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
                        <span className="team-code">{details.prosecution}</span>
                        <span className="team-label-role">{prosecutionLabel}</span>
                    </div>
                    <div className="team-label team-label--defense">
                        <span className="team-code team-code--defense">{details.defense}</span>
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
                    <label className={`tiebreaker-option${tiebreaker === details.prosecution ? " tiebreaker-option--selected" : ""}`}>
                        <input type="radio" name="tiebreaker" value={details.prosecution} checked={tiebreaker === details.prosecution} onChange={(e) => setTiebreaker(e.target.value)} />
                        <span className="tiebreaker-code">{details.prosecution}</span>
                        <span className="tiebreaker-role">{prosecutionLabel}</span>
                    </label>
                    <label className={`tiebreaker-option${tiebreaker === details.defense ? " tiebreaker-option--selected" : ""}`}>
                        <input type="radio" name="tiebreaker" value={details.defense} checked={tiebreaker === details.defense} onChange={(e) => setTiebreaker(e.target.value)} />
                        <span className="tiebreaker-code">{details.defense}</span>
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
                        <p>You selected team <strong>{tiebreaker} — {tiebreaker === details.prosecution ? prosecutionLabel : "Defense"}</strong>. This cannot be undone.</p>
                        <div className="confirm-actions">
                            <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
                            <button type="button" onClick={handleSubmit}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TiebreakerOnly;
