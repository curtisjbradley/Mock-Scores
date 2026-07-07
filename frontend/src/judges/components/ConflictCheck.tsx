import "../styles/conflict-check.css";
import { useState } from "react";
import type { IScoreSheetFormat } from "@mock-scores/shared";

interface ConflictCheckProps {
    /** Full scoresheet data used to display trial and scorer info. */
    details: IScoreSheetFormat;
    /** Called when the scorer clicks "Proceed" after reviewing for conflicts. */
    onProceed: () => void;
}

/**
 * Pre-trial conflict-of-interest screen shown before the scoresheet.
 * Displays the scorer's name, presider, courtroom, and both team codes (never school names).
 * The scorer must either proceed or report a conflict before scoring begins.
 */
function ConflictCheck({ details, onProceed }: ConflictCheckProps) {
    const prosecutionLabel = details.isCriminal ? "Prosecution" : "Plaintiff";
    const [reported, setReported] = useState(false);
    const [reporting, setReporting] = useState(false);

    const handleReportConflict = async () => {
        setReporting(true);
        try {
            await fetch(`/api/score/${details.scorer.scorerID}/conflict`, { method: 'POST' });
        } catch {
            // best-effort — always show the confirmation
        }
        setReporting(false);
        setReported(true);
    };

    if (reported) {
        return (
            <div className="conflict-check">
                <div className="conflict-card">
                    <h1 className="conflict-title">Conflict Reported</h1>
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                        The tournament organizer has been notified. Please do not score this round.
                        You may close this tab.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="conflict-check">
            <div className="conflict-card">
                <h1 className="conflict-title">Before You Begin</h1>

                <dl className="conflict-info">
                    <div className="conflict-info-row">
                        <dt>Your Name</dt>
                        <dd>{details.scorer.firstName} {details.scorer.lastName}</dd>
                    </div>
                    <div className="conflict-info-row">
                        <dt>Presider</dt>
                        <dd>{details.presiderName}</dd>
                    </div>
                    <div className="conflict-info-row">
                        <dt>Courtroom</dt>
                        <dd>{details.courtroomNumber}</dd>
                    </div>
                    <div className="conflict-info-row">
                        <dt>{prosecutionLabel} Team</dt>
                        <dd className="conflict-team-code">{details.prosecutionCode}</dd>
                    </div>
                    <div className="conflict-info-row">
                        <dt>Defense Team</dt>
                        <dd className="conflict-team-code">{details.defenseCode}</dd>
                    </div>
                </dl>

                <p className="conflict-prompt">
                    Please look around for any conflicts of interest before proceeding.
                </p>

                <div className="conflict-actions">
                    {!details.scorer.isPaper && (
                        <button type="button" className="conflict-btn-report" disabled={reporting} onClick={handleReportConflict}>
                            {reporting ? 'Reporting…' : 'Report Conflict'}
                        </button>
                    )}
                    <button type="button" className="conflict-btn-proceed" onClick={onProceed}>
                        Proceed
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConflictCheck;
