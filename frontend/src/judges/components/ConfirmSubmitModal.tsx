import { API_BASE } from "../../config";
import "../styles/modal.css";
import { useEffect, useRef, useState } from "react";
import type {
  IScoreSheetFormat,
  ScorecardPayload,
  ScoreSection,
} from "@mock-scores/shared";
import type { NominationSelections, ScoreResults } from "./ScoreSheet.tsx";

interface IConfirmSubmitModalProps {
  setShowConfirm: (confirm: boolean) => void;
  pendingScores: ScoreResults | null;
  setPendingScores: (scores: ScoreResults | null) => void;
  nominations: NominationSelections;
  showTiebreaker: boolean;
  storageKey: string;
  prosecution: string;
  defense: string;
  defense_id: string;
  prosecution_id: string;
  prosecutionLabel: string;
  details: IScoreSheetFormat;
  onSubmitSuccess: () => void;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Final confirmation after all scores and nominations are entered on the sheet. */
const ConfirmSubmitModal = ({
  setShowConfirm,
  pendingScores,
  setPendingScores,
  nominations,
  storageKey,
  prosecution,
  defense,
  prosecutionLabel,
  details,
  onSubmitSuccess,
  defense_id,
  prosecution_id,
  showTiebreaker,
}: IConfirmSubmitModalProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tiebreaker, setTiebreaker] = useState("");

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  const reset = () => {
    setShowConfirm(false);
    setPendingScores(null);
    setTiebreaker("");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        reset();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const handleConfirm = async () => {
    if (!pendingScores || (showTiebreaker && !tiebreaker) || submitting) return;

    const scores = details.categoryOrder.flatMap((categoryId) => {
      const category = details.scoringCategories[categoryId];
      return category.categoryAssignments.flatMap((assignment) => {
        const entries: ScoreSection[] = [];
        if (assignment.side !== "D") {
          const score = pendingScores[`${assignment.assignmentKey}P`];
          if (typeof score === "number")
            entries.push({
              categoryId,
              assignmentKey: assignment.assignmentKey,
              side: "P",
              studentId: assignment.pStudentId ?? null,
              score,
            });
        }
        if (assignment.side !== "P") {
          const score = pendingScores[`${assignment.assignmentKey}D`];
          if (typeof score === "number")
            entries.push({
              categoryId,
              assignmentKey: assignment.assignmentKey,
              side: "D",
              studentId: assignment.dStudentId ?? null,
              score,
            });
        }
        return entries;
      });
    });
    const nominationPayload = Object.entries(nominations).flatMap(
      ([awardCategoryId, studentIds]) =>
        studentIds.map((studentId, index) => ({
          awardCategoryId,
          studentId,
          rank: index + 1,
        })),
    );
    const layout = details.categoryOrder.flatMap((categoryId) => {
      const category = details.scoringCategories[categoryId];
      const witnessName = category.witnessId
        ? (details.witnesses[category.witnessId]?.characterName ?? null)
        : null;
      return category.categoryAssignments.map((assignment) => ({
        assignmentKey: assignment.assignmentKey,
        assignmentName: assignment.assignmentName,
        categoryName: category.categoryName,
        witnessName,
        side: assignment.side,
        pStudentName: assignment.pStudentId
          ? (details.students[assignment.pStudentId]?.name ?? null)
          : null,
        dStudentName: assignment.dStudentId
          ? (details.students[assignment.dStudentId]?.name ?? null)
          : null,
      }));
    });
    const payload: ScorecardPayload = {
      pairingID: details.pairingID,
      scores,
      nominations: nominationPayload,
      tiebreaker,
      layout,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        `${API_BASE}/score/${details.scorer.scorerID}/ballot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (response.status === 409)
        setSubmitError("This ballot has already been submitted.");
      else if (!response.ok)
        setSubmitError("Something went wrong. Please try again.");
      else {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}-category`);
        onSubmitSuccess();
        return;
      }
    } catch {
      setSubmitError(
        "Network error. Please check your connection and try again.",
      );
    }
    setSubmitting(false);
  };

  const canConfirm = (!showTiebreaker || Boolean(tiebreaker)) && !submitting;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) reset();
      }}
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
        <p id="confirm-desc">
          Please confirm your scores and award nominations. This cannot be
          undone.
        </p>
        {showTiebreaker && (
          <div className="tiebreaker-section">
            <h3>Tiebreaker</h3>
            <p>If the scores are tied, which team wins?</p>
            <div className="tiebreaker-options">
              <label
                className={`tiebreaker-option${tiebreaker === prosecution_id ? " tiebreaker-option--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="tiebreaker"
                  value={prosecution_id}
                  checked={tiebreaker === prosecution_id}
                  onChange={(event) => setTiebreaker(event.target.value)}
                />
                <span className="tiebreaker-code">{prosecution}</span>
                <span className="tiebreaker-role">{prosecutionLabel}</span>
              </label>
              <label
                className={`tiebreaker-option${tiebreaker === defense_id ? " tiebreaker-option--selected" : ""}`}
              >
                <input
                  type="radio"
                  name="tiebreaker"
                  value={defense_id}
                  checked={tiebreaker === defense_id}
                  onChange={(event) => setTiebreaker(event.target.value)}
                />
                <span className="tiebreaker-code">{defense}</span>
                <span className="tiebreaker-role">Defense</span>
              </label>
            </div>
            {!tiebreaker && (
              <p className="ranking-error" role="alert">
                Please select a tiebreaker team.
              </p>
            )}
          </div>
        )}
        <div className="confirm-actions">
          <button type="button" onClick={reset} disabled={submitting}>
            Cancel
          </button>
          <button
            id="confirm-button"
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {submitting ? "Submitting…" : "Confirm"}
          </button>
        </div>
        {submitError && (
          <p className="ranking-error" role="alert">
            {submitError}
          </p>
        )}
      </div>
    </div>
  );
};

export default ConfirmSubmitModal;
