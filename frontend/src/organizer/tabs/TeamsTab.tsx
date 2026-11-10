import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ITeam } from "@mock-scores/shared";
import {
  ChangeTeamOwnerModal,
  ConfirmRemoveModal,
  EditTeamModal,
} from "../components/modals";
import Section from "./Section";
import AddTeamModal from "../components/AddTeamModal";
import CsvImportModal from "../../shared/components/CsvImportModal";
import { apiFetch } from "../../auth/auth";
import { useConfirmRemove } from "../../shared/hooks/useConfirmRemove";
import DangerButton from "../../shared/components/DangerButton";
import AddButton from "../../shared/components/AddButton";
import StatusChip from "../../shared/components/StatusChip";
import EmailStatusBadge from "../../shared/components/EmailStatusBadge";

const TEAM_ISSUE_FILTERS = [
  { id: "without-rosters", label: "No roster" },
  { id: "without-default-assignments", label: "No default assignments" },
  { id: "without-default-call-orders", label: "No call orders" },
  { id: "without-coaches", label: "No coaches" },
] as const;

type TeamIssueFilter = (typeof TEAM_ISSUE_FILTERS)[number]["id"];

export default function TeamsTab({ tournamentId }: { tournamentId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const issueDropdownRef = useRef<HTMLDetailsElement>(null);
  const activeIssues = new Set<TeamIssueFilter>(
    searchParams
      .getAll("issue")
      .flatMap((value) => value.split(","))
      .filter((value): value is TeamIssueFilter =>
        TEAM_ISSUE_FILTERS.some((filter) => filter.id === value),
      ),
  );
  const [teams, setTeams] = useState<ITeam[]>([]);
  const [showModal, setShowModal] = useState(false);
  const confirmRemove = useConfirmRemove<ITeam>();
  const [editingTeam, setEditingTeam] = useState<ITeam | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerChange, setOwnerChange] = useState<{
    team: ITeam;
    email: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    for (const issue of activeIssues) params.append("issue", issue);
    const query = params.toString();
    apiFetch(
      `/organizer/tournament/${tournamentId}/teams${query ? `?${query}` : ""}`,
    )
      .then((r) => r.json())
      .then(setTeams)
      .catch(console.error);
  }, [tournamentId, searchParams]);

  useEffect(() => {
    const closeIssueDropdown = (event: PointerEvent) => {
      const dropdown = issueDropdownRef.current;
      if (
        dropdown?.open &&
        event.target instanceof Node &&
        !dropdown.contains(event.target)
      ) {
        dropdown.open = false;
      }
    };
    document.addEventListener("pointerdown", closeIssueDropdown);
    return () =>
      document.removeEventListener("pointerdown", closeIssueDropdown);
  }, []);

  const setActiveIssues = (issues: Set<TeamIssueFilter>) => {
    const next = new URLSearchParams(searchParams);
    next.delete("issue");
    for (const issue of issues) next.append("issue", issue);
    setSearchParams(next);
  };

  const toggleIssue = (issue: TeamIssueFilter) => {
    const next = new Set(activeIssues);
    if (next.has(issue)) next.delete(issue);
    else next.add(issue);
    setActiveIssues(next);
  };

  const putTeam = async (
    team: ITeam,
    patch: Partial<ITeam>,
  ): Promise<boolean> => {
    const res = await apiFetch(`/organizer/tournament/${tournamentId}/teams`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: { ...team, ...patch } }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "Unable to update the team. Please try again.");
      return false;
    }
    const updated: ITeam = await res.json();
    setTeams((prev) => prev.map((t) => (t.id === team.id ? updated : t)));
    return true;
  };

  const handleAdd = async (name: string, email: string, code: string) => {
    const res = await apiFetch(`/organizer/tournament/${tournamentId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: { name, coach_email: email, code } }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "Unable to add the team. Please try again.");
      return;
    }
    const team: ITeam = await res.json();
    setTeams((prev) => [...prev, team]);
    setShowModal(false);
  };

  const handleRemove = async (team: ITeam) => {
    const res = await apiFetch(`/organizer/tournament/${tournamentId}/teams`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: team.id }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "Unable to remove the team. Please try again.");
      return;
    }
    setTeams((prev) => prev.filter((t) => t.id !== team.id));
    confirmRemove.clear();
  };

  const changeOwner = async (retainPreviousOwner: boolean) => {
    if (!ownerChange) return;
    const { team, email } = ownerChange;
    const res = await apiFetch(
      `/organizer/tournament/${tournamentId}/teams/${team.id}/owner-email`,
      {
        method: "PUT",
        body: JSON.stringify({ email, retainPreviousOwner }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(
        body?.message ?? "Unable to change the team owner. Please try again.",
      );
      return;
    }
    const refreshed = await apiFetch(
      `/organizer/tournament/${tournamentId}/teams`,
    );
    if (refreshed.ok) setTeams((await refreshed.json()) as ITeam[]);
    setOwnerChange(null);
  };

  const exportRosters = async () => {
    const res = await apiFetch(
      `/organizer/tournament/${tournamentId}/export/rosters`,
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rosters.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      title="Teams"
      description={
        activeIssues.size > 0
          ? "Only teams requiring attention are shown."
          : "Manage invited teams"
      }
    >
      {error && (
        <p className="coach-save-error" role="alert">
          {error}
        </p>
      )}
      <div className="tab-actions teams-tab-actions">
        <AddButton
          className="teams-tab-actions__full"
          onClick={() => setShowModal(true)}
        >
          + Add team
        </AddButton>
        <button
          className="btn-primary tab-actions-import"
          onClick={() => setShowImport(true)}
        >
          Import CSV
        </button>
        <button
          className="btn-secondary tab-actions-import"
          onClick={() => {
            void exportRosters();
          }}
        >
          Export All Rosters
        </button>
      </div>

      <div className="teams-issue-filters">
        <div className="teams-active-issues" aria-label="Active filters">
          {TEAM_ISSUE_FILTERS.filter((issue) => activeIssues.has(issue.id)).map(
            (issue) => (
              <button
                key={issue.id}
                type="button"
                className="teams-active-issue"
                onClick={() => toggleIssue(issue.id)}
                aria-label={`Remove ${issue.label} filter`}
              >
                <StatusChip label={`${issue.label} x`} variant="danger" />
              </button>
            ),
          )}
        </div>
        <details ref={issueDropdownRef} className="teams-issue-dropdown">
          <summary aria-label="Filter teams" title="Filter teams">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            <span>Filter</span>
          </summary>
          <div className="teams-issue-panel">
            <fieldset>
              <legend>Show teams with any of these issues</legend>
              {TEAM_ISSUE_FILTERS.map((issue) => (
                <label key={issue.id} className="teams-issue-option">
                  <input
                    type="checkbox"
                    checked={activeIssues.has(issue.id)}
                    onChange={() => toggleIssue(issue.id)}
                  />
                  <span>{issue.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </details>
      </div>

      <div className="dash-table-scroll teams-table-wrap">
        <table className="dash-standings-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Code</th>
              <th>Contact</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 && (
              <tr>
                <td colSpan={5} className="dash-empty-cell">
                  No teams match the selected issues.
                </td>
              </tr>
            )}
            {teams.map((team) => (
              <tr key={team.id}>
                <td data-label="Team">
                  <Link
                    className="dash-table-link"
                    to={`/organizer/${tournamentId}/team/${team.id}`}
                  >
                    {team.name}
                  </Link>
                </td>
                <td data-label="Code">{team.code}</td>
                <td data-label="Contact">
                  <span className="dash-judge-name">
                    {team.coach_email}
                    <EmailStatusBadge status={team.email_status} />
                  </span>
                </td>
                <td data-label="Status">
                  <StatusChip
                    label={team.has_joined ? "accepted" : "pending"}
                    variant={team.has_joined ? "submitted" : "pending"}
                  />
                </td>
                <td data-label="Actions">
                  <div className="dash-actions-cell">
                    <button
                      className="dash-remove-btn"
                      onClick={() => setEditingTeam(team)}
                    >
                      Edit
                    </button>
                    <DangerButton onClick={() => confirmRemove.open(team)}>
                      Remove
                    </DangerButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AddTeamModal
          existingNames={teams.map((t) => t.name)}
          onClose={() => setShowModal(false)}
          onAdd={(name, email, code) => {
            void handleAdd(name, email, code);
          }}
        />
      )}

      {editingTeam && (
        <EditTeamModal
          team={editingTeam}
          existingNames={teams
            .filter((t) => t.id !== editingTeam.id)
            .map((t) => t.name)}
          onClose={() => setEditingTeam(null)}
          onSave={(name, code, email) => {
            if (
              editingTeam.has_joined &&
              email.toLowerCase() !== editingTeam.coach_email.toLowerCase()
            ) {
              void putTeam(editingTeam, { name, code });
              setOwnerChange({ team: editingTeam, email });
            } else {
              void putTeam(editingTeam, { name, code, coach_email: email });
            }
          }}
        />
      )}

      {confirmRemove.pending && (
        <ConfirmRemoveModal
          message="Remove this team from the tournament?"
          onCancel={confirmRemove.clear}
          onConfirm={() => {
            void handleRemove(confirmRemove.pending!);
          }}
        />
      )}

      {ownerChange && (
        <ChangeTeamOwnerModal
          currentEmail={ownerChange.team.coach_email}
          newEmail={ownerChange.email}
          onCancel={() => setOwnerChange(null)}
          onKeepPrevious={() => {
            void changeOwner(true);
          }}
          onRemovePrevious={() => {
            void changeOwner(false);
          }}
        />
      )}

      {showImport && (
        <CsvImportModal
          title="Import Teams"
          description="Upload a CSV file with team information. Each row will be added as a new team."
          columns={["name", "coach_email", "code (optional)"]}
          exampleRow="Eagles,coach@school.edu,EGL"
          onClose={() => {
            setShowImport(false);
            // Refresh teams list after import
            apiFetch(`/organizer/tournament/${tournamentId}/teams`)
              .then((r) => r.json())
              .then(setTeams)
              .catch(console.error);
          }}
          onImport={async (csv) => {
            const res = await apiFetch(
              `/organizer/tournament/${tournamentId}/import/teams`,
              {
                method: "POST",
                body: JSON.stringify({ csv }),
              },
            );
            if (!res.ok) throw new Error("Import failed");
            return res.json();
          }}
        />
      )}
    </Section>
  );
}
