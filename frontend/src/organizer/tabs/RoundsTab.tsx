import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { IRound } from "@mock-scores/shared";
import Section from "./Section";
import AddButton from "../../shared/components/AddButton";
import { apiFetch } from "../../auth/auth";
import "../styles/rounds.css";

interface RoundReadiness {
  pairings: number;
  warnings: { issue: string; label: string }[];
}
interface RoundListEntry extends IRound {
  ballot: { total: number; submitted: number };
  readiness: RoundReadiness;
}

function RoundRow({
  round,
  tournamentId,
  ballotSummary,
  readiness,
}: {
  round: IRound;
  tournamentId: string;
  ballotSummary: { total: number; submitted: number } | null;
  readiness: RoundReadiness | null;
}) {
  const navigate = useNavigate();
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const openRound = () =>
    navigate(`/organizer/${tournamentId}/round/${round.round_id}`);

  return (
    <div
      className="dash-round-summary"
      role="button"
      tabIndex={0}
      aria-label={`Open ${round.name}`}
      onClick={openRound}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRound();
        }
      }}
    >
      <div className="dash-round-summary-head">
        <div>
          <h3>{round.name}</h3>
          <p>
            {round.round_time
              ? new Date(round.round_time).toLocaleString()
              : "Not Scheduled"}
          </p>
        </div>
        {ballotSummary && ballotSummary.total > 0 && (
          <span
            className={`pc-ballot-status ${
              ballotSummary.submitted === ballotSummary.total
                ? "pc-ballot-status--complete"
                : ballotSummary.submitted > 0
                  ? "pc-ballot-status--partial"
                  : "pc-ballot-status--none"
            }`}
          >
            {ballotSummary.submitted}/{ballotSummary.total} ballots
          </span>
        )}
      </div>
      <div className="dash-round-readiness">
        <div className="dash-round-status-row">
          <span className="dash-round-pairings">
            {readiness?.pairings ?? 0} matchup
            {readiness?.pairings === 1 ? "" : "s"}
          </span>
          {round.locked && (
            <span className="dash-round-chip dash-round-chip--locked">
              Locked
            </span>
          )}
          {round.teams_public && (
            <span className="dash-round-chip">Teams published</span>
          )}
          {round.results_public && (
            <span className="dash-round-chip">Results published</span>
          )}
        </div>
        {readiness?.warnings.length ? (
          <div className="dash-round-issues">
            <button
              className="dash-round-issue-count"
              aria-expanded={issuesExpanded}
              onClick={(event) => {
                event.stopPropagation();
                setIssuesExpanded((expanded) => !expanded);
              }}
            >
              {readiness.warnings.length} Issue
              {readiness.warnings.length === 1 ? "" : "s"}
            </button>
            {issuesExpanded && (
              <div>
                {readiness.warnings.map((warning) => (
                  <button
                    key={warning.issue}
                    className="dash-round-issue"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(
                        `/organizer/${tournamentId}/round/${round.round_id}${warning.issue === "no-pairings" ? "" : `?issue=${warning.issue}`}`,
                      );
                    }}
                  >
                    {warning.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          readiness && <span className="dash-round-ready">Ready to run</span>
        )}
      </div>
    </div>
  );
}

export default function RoundsTab({ tournamentId }: { tournamentId: string }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const withoutPairings = searchParams.get("issue") === "without-pairings";
  const [rounds, setRounds] = useState<IRound[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ballotStatusByRound, setBallotStatusByRound] = useState<
    Record<string, { total: number; submitted: number }>
  >({});
  const [readinessByRound, setReadinessByRound] = useState<
    Record<string, RoundReadiness>
  >({});

  useEffect(() => {
    apiFetch(`/organizer/tournament/${tournamentId}/rounds`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: RoundListEntry[]) => {
        const visible = withoutPairings
          ? data.filter((entry) => entry.readiness.pairings === 0)
          : data;
        setRounds(visible);
        setBallotStatusByRound(
          Object.fromEntries(
            visible.map((entry) => [entry.round_id, entry.ballot]),
          ),
        );
        setReadinessByRound(
          Object.fromEntries(
            visible.map((entry) => [entry.round_id, entry.readiness]),
          ),
        );
      })
      .catch(() => setError("Failed to load rounds."));
  }, [tournamentId, withoutPairings]);

  const handleAdd = () => {
    apiFetch(`/organizer/tournament/${tournamentId}/rounds`, {
      method: "POST",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((created: IRound) => {
        setRounds((prev) => [...prev, created]);
      })
      .catch(() => setError("Failed to add round."));
  };

  const sorted = [...rounds].sort((a, b) => a.position - b.position);

  return (
    <>
      <Section
        title={withoutPairings ? "Rounds Without Pairings" : "Rounds"}
        description={
          withoutPairings
            ? "Only rounds requiring pairings are shown."
            : undefined
        }
      >
        {error && <p className="org-error">{error}</p>}
        {withoutPairings && (
          <button
            className="btn-secondary"
            onClick={() => navigate(`?page=rounds`)}
          >
            Show all rounds
          </button>
        )}
        <AddButton onClick={handleAdd}>+ Add round</AddButton>
        {sorted.map((round) => (
          <RoundRow
            key={round.round_id}
            round={round}
            tournamentId={tournamentId}
            ballotSummary={ballotStatusByRound[round.round_id] ?? null}
            readiness={readinessByRound[round.round_id] ?? null}
          />
        ))}
      </Section>
    </>
  );
}
