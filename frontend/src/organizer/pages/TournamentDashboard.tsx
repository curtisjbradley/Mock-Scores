import { useState } from "react";
import { useParams } from "react-router-dom";
import "../styles/organizer.css";
import "../styles/tabs.css";
import "../styles/rounds.css";
import "../styles/pairings.css";
import "../styles/standings.css";
import "../../shared/styles/dashboard.css";
import { useSearchParamTab } from "../../shared/hooks/useSearchParamTab";
import {
  type OrganizerTab,
  type OrganizerScreen,
  VALID_SCREENS,
} from "../constants";
import OverviewTab from "../tabs/OverviewTab";
import RoundsTab from "../tabs/RoundsTab";
import StandingsTab from "../tabs/StandingsTab";
import WitnessesTab from "../tabs/WitnessesTab";
import ScoringTab from "../tabs/ScoringTab";
import TeamsTab from "../tabs/TeamsTab";
import OrganizersTab from "../tabs/OrganizersTab";
import ScorersTab from "../tabs/ScorersTab";
import CourtroomsTab from "../tabs/CourtroomsTab";
import TournamentSettingsTab from "../tabs/TournamentSettingsTab";
import TiebreakersTab from "../tabs/TiebreakersTab";
import AwardCategoriesTab from "../tabs/AwardCategoriesTab";
import { CustomRosterFields } from "../tabs/CustomRosterFields.tsx";

// Primary navigation — icon names map to SVGs in `public/icons/`.
const STRUCTURE_CARDS: { label: string; tab: OrganizerTab }[] = [
  { label: "Tournament Details", tab: "tournament" },
  { label: "Manage Scorecard", tab: "scoring" },
  { label: "Manage Witnesses", tab: "witnesses" },
  { label: "Manage Awards", tab: "awards" },
  { label: "Manage Tiebreakers", tab: "tiebreakers" },
  { label: "Custom Roster Fields", tab: "custom-roster-fields" },
];

export default function TournamentDashboard() {
  const { id } = useParams<{ id: string }>();
  const [screen, setScreen] = useSearchParamTab<OrganizerScreen>(
    "overview",
    VALID_SCREENS,
  );
  const [visitedTabs, setVisitedTabs] = useState<Set<OrganizerTab>>(() => {
    if (screen !== "overview" && screen !== "structure")
      return new Set([screen as OrganizerTab]);
    return new Set();
  });

  const goToTab = (tab: OrganizerTab) => {
    setScreen(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
  };

  // Sidebar selection. "structure" reveals a card grid; tabs are lazily mounted.
  const onNavSelect = (next: OrganizerScreen) => {
    if (next === "overview" || next === "structure") setScreen(next);
    else goToTab(next as OrganizerTab);
  };

  if (!id) return null;

  const activeTab =
    screen !== "overview" && screen !== "structure"
      ? (screen as OrganizerTab)
      : null;
  // A tab opened directly from the URL must render immediately, while tabs
  // reached through dashboard navigation stay mounted to preserve their state.
  const mountedTabs = activeTab
    ? new Set([...visitedTabs, activeTab])
    : visitedTabs;
  return (
    <>
      {screen === "overview" && (
        <OverviewTab tournamentId={id} onNavigate={onNavSelect} />
      )}

      {screen === "structure" && (
        <div className="dash-card-grid">
          {STRUCTURE_CARDS.map((c) => (
            <button
              key={c.tab}
              className="dash-nav-card"
              onClick={() => goToTab(c.tab)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {mountedTabs.has("tournament") && (
        <div hidden={activeTab !== "tournament"}>
          <TournamentSettingsTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("teams") && (
        <div hidden={activeTab !== "teams"}>
          <TeamsTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("scorers") && (
        <div hidden={activeTab !== "scorers"}>
          <ScorersTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("courtrooms") && (
        <div hidden={activeTab !== "courtrooms"}>
          <CourtroomsTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("custom-roster-fields") && (
        <div hidden={activeTab !== "custom-roster-fields"}>
          <CustomRosterFields tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("organizers") && (
        <div hidden={activeTab !== "organizers"}>
          <OrganizersTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("witnesses") && (
        <div hidden={activeTab !== "witnesses"}>
          <WitnessesTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("scoring") && (
        <div hidden={activeTab !== "scoring"}>
          <ScoringTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("rounds") && (
        <div hidden={activeTab !== "rounds"}>
          <RoundsTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("standings") && (
        <div hidden={activeTab !== "standings"}>
          <StandingsTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("tiebreakers") && (
        <div hidden={activeTab !== "tiebreakers"}>
          <TiebreakersTab tournamentId={id} />
        </div>
      )}
      {mountedTabs.has("awards") && (
        <div hidden={activeTab !== "awards"}>
          <AwardCategoriesTab tournamentId={id} />
        </div>
      )}
    </>
  );
}
