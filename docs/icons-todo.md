# Icons To Be Made

Tracks the glyphs used across the frontend and their designed-icon replacements.
Designed SVGs live in `frontend/public/icons/` and are referenced at runtime as
`/icons/<Name>.svg`.

Two groups:

1. **Navigation icons** — dashboard sidebar glyphs.
2. **Inline action glyphs** — Unicode/ASCII characters used inside buttons and
   links to represent actions (back, next, download, publish, etc.).

All sidebar icons render through `frontend/src/shared/components/DashboardSidebar.tsx`
(the `icon` field of `DashboardNavItem`). Locations below are `path:line`.

## Assets present in `frontend/public/icons/`

`Courtrooms`, `Download`, `Expand`, `Notifications-Disabled`,
`Notifications-Enabled`, `Organizers`, `Overview`, `Results`, `Roster`,
`Rounds`, `Schedule`, `Scorers`, `Settings`, `Shrink`, `Standings`, `Teams`,
`Upload`.

**Decisions applied:**
- **Field** reuses `Teams.svg`.
- **Structure** reuses `Settings.svg`.

**Status:** All icons render through the shared `<Icon>` component
(`shared/components/Icon.tsx`), which masks a `public/icons/*.svg` and fills it
with `var(--text)` (via `.app-icon` in `shared/components/styles/icon.css`). Pass
an icon **name** string. Wired: sidebar nav items + collapse toggle
(`DashboardSidebar`), download-ballot button (`PairingCard`), CSV upload label
(`CsvImportModal`), and the coach notifications toggle (`CoachesPage`).

> Note: `frontend/public/icons.svg` (singular) is used elsewhere and is
> unrelated to the `public/icons/` folder.

---

## 1. Navigation Icons (dashboard sidebars)

Source files:
- `frontend/src/organizer/pages/TournamentDashboard.tsx` (`NAV_ITEMS`)
- `frontend/src/coach/CoachLayout.tsx` (`NAV_ITEMS`)

### Organizer dashboard

- [x] **Overview** → `/icons/Overview.svg` — `organizer/pages/TournamentDashboard.tsx:29`
- [x] **Rounds** → `/icons/Rounds.svg` — `organizer/pages/TournamentDashboard.tsx:30`
- [x] **Standings** → `/icons/Standings.svg` — `organizer/pages/TournamentDashboard.tsx:31`
- [x] **Teams** → `/icons/Teams.svg` — `organizer/pages/TournamentDashboard.tsx:32`
- [x] **Scorers** → `/icons/Scorers.svg` — `organizer/pages/TournamentDashboard.tsx:33`
- [x] **Courtrooms** → `/icons/Courtrooms.svg` — `organizer/pages/TournamentDashboard.tsx:34`
- [x] **Organizers** → `/icons/Organizers.svg` — `organizer/pages/TournamentDashboard.tsx:35`
- [x] **Structure** → `/icons/Settings.svg` — `organizer/pages/TournamentDashboard.tsx:36`

### Coach dashboard

- [x] **Overview** → `/icons/Overview.svg` — `coach/CoachLayout.tsx:25`
- [x] **Schedule** → `/icons/Schedule.svg` — `coach/CoachLayout.tsx:26`
- [x] **Results** → `/icons/Results.svg` — `coach/CoachLayout.tsx:27`
- [ ] **Coaches** → *(icon needed)* — `coach/CoachLayout.tsx:28`
- [x] **Roster** → `/icons/Roster.svg` — `coach/CoachLayout.tsx:29`
- [x] **Field** → `/icons/Teams.svg` — `coach/CoachLayout.tsx:30`
- [x] **Standings** → `/icons/Standings.svg` — `coach/CoachLayout.tsx:31`

### Sidebar collapse control

- [x] **Collapse / expand sidebar** → `/icons/Shrink.svg` / `/icons/Expand.svg`
  — `shared/components/DashboardSidebar.tsx:74`

---

## 2. Inline Action Glyphs (buttons & links)

Unicode characters embedded directly in button/link text. Replacing them with
designed icons unifies the action language across the app.

### Back / navigation arrows (`←`)

- [ ] **Back** arrow `←` — *(icon needed)*:
  - `organizer/pages/ScorecardViewer.tsx:141` ("← Back")
  - `organizer/pages/ScorecardViewer.tsx:152` ("← Back")
  - `organizer/pages/ScorecardViewer.tsx:178` ("← Back to tournament")
  - `shared/components/CombinedScoresheetPage.tsx:222` ("← Back")
  - `shared/components/CombinedScoresheetPage.tsx:231` ("← Back")
  - `shared/components/CombinedScoresheetPage.tsx:240` ("← Back")
  - `coach/pages/AssignRoles.tsx:109` ("← Back to schedule")
  - `coach/pages/WitnessCallOrder.tsx:74` ("← Back to schedule")
  - `organizer/pages/RoundView.tsx:84` ("← Back to rounds")
  - `organizer/pages/TournamentNew.tsx:189` ("← Back" / "← All tournaments")
  - `organizer/steps/TournamentAwards.tsx:102` ("← Back")
  - `organizer/steps/TournamentCaseFormat.tsx:131` ("← Back")
  - `organizer/steps/TournamentDetails.tsx:90` ("← Back")
  - `organizer/steps/TournamentScoringTemplate.tsx:65` ("← Back")
  - `organizer/steps/TournamentStandings.tsx:56` ("← Back")
  - `error/Forbidden.tsx:15` ("← Go back")
  - `error/Forbidden.tsx:17` ("← Go home")
  - `judges/components/ScoreSheet.tsx:285` ("← Previous")

### Forward / proceed arrows (`→`)

- [ ] **Next / proceed** arrow `→` — *(icon needed)*:
  - `organizer/steps/TournamentAwards.tsx:103` ("Next →")
  - `organizer/steps/TournamentCaseFormat.tsx:132` ("Next →")
  - `organizer/steps/TournamentDetails.tsx:91` ("Next →")
  - `organizer/steps/TournamentScoringTemplate.tsx:66` ("Next →")
  - `organizer/steps/TournamentStandings.tsx:57` ("Create tournament →")
  - `organizer/pages/TournamentNew.tsx:217` (stepper "Next →")
  - `judges/components/ScoreSheet.tsx:291` ("Next →")
- [ ] **Quick-link / drill-in** arrow `→` — *(icon needed)*:
  - `organizer/tabs/OverviewTab.tsx:87` ("Manage rounds →")
  - `organizer/tabs/OverviewTab.tsx:93` ("Add a round →")
  - `organizer/tabs/OverviewTab.tsx:102` ("Manage teams →")
  - `organizer/tabs/OverviewTab.tsx:113` ("Manage rounds →")
  - `organizer/tabs/OverviewTab.tsx:131` ("Manage scorers →")
  - `coach/pages/OverviewPage.tsx:63` ("View schedule →")
  - `coach/pages/OverviewPage.tsx:75` ("View field →")
  - `coach/pages/OverviewPage.tsx:83` ("View standings →")
  - `coach/pages/OverviewPage.tsx:97` ("Complete prep →")
  - `coach/pages/OverviewPage.tsx:111` ("View results →")
  - `organizer/tabs/RoundsTab.tsx:72` ("Open →")

### Reorder arrows (`↑` / `↓`)

- [ ] **Move up / move down** `↑` `↓` — *(icon needed)*:
  - `judges/components/ConfirmSubmitModal.tsx:339` (`aria-label="Move up"`, `↑`)
  - `judges/components/ConfirmSubmitModal.tsx:340` (`aria-label="Move down"`, `↓`)

### Confirmation check (`✓`)

- [ ] **Success / done / published** check `✓` — *(icon needed)*:
  - `coach/pages/SchedulePage.tsx:66` ("✓ Roles assigned")
  - `coach/pages/SchedulePage.tsx:73` ("✓ Call order set")
  - `organizer/tabs/RoundsTab.tsx:54` ("✓ Pairings published")
  - `organizer/tabs/RoundsTab.tsx:60` ("✓ Results published")
  - `organizer/components/TournamentStepper.tsx:36` (completed step marker)
  - `shared/components/CsvImportModal.tsx:141` ("✓ Successfully imported …")

### Close (`✕`)

- [ ] **Close** `✕` — *(icon needed)*:
  - `organizer/blockly/StandingsBuilder.tsx:306` ("✕ Close")
  - `organizer/blockly/StandingsBuilder.tsx:316` ("✕ Close")
  - `organizer/blockly/TiebreakerViewer.tsx:37` ("✕ Close")

### Add (`+`)

- [ ] **Add** `+` — *(icon needed)* — prefix on add buttons (mostly via `shared/components/AddButton.tsx`):
  - `coach/pages/CoachesPage.tsx:25` ("+ Add coach")
  - `coach/pages/RosterPage.tsx:274` ("+ Add")
  - `organizer/tabs/TeamsTab.tsx:75` ("+ Add team")
  - `organizer/tabs/ScorersTab.tsx:146` ("+ Add scorer")
  - `organizer/tabs/CourtroomsTab.tsx:50` ("+ Add courtroom")
  - `organizer/tabs/OrganizersTab.tsx:54` ("+ Add Organizer")
  - `organizer/tabs/RoundsTab.tsx:161` ("+ Add round")
  - `organizer/tabs/AwardCategoriesTab.tsx:99` ("+ Add category")
  - `organizer/components/PairingCard.tsx:321` ("+ Add Scorer")
  - `organizer/steps/TournamentScoringFields.tsx:95` ("+ Add category")
  - `organizer/steps/TournamentAwards.tsx:97` ("+ Add award category")
  - `organizer/components/ScoringCategoryCard.tsx:128` ("+ Add field")
  - `shared/components/WitnessNameList.tsx:65` ("+ {addLabel}")

### Download (`⬇`)

- [x] **Download ballot** → `/icons/Download.svg` (wired)
  - `organizer/components/PairingCard.tsx:167` — now renders `<img class="pc-btn-icon">`

### Upload

- [x] **Upload** → `/icons/Upload.svg` (wired)
  - `shared/components/CsvImportModal.tsx` — icon in the "Upload CSV file" label

### Warning (`⚠`)

- [ ] **Warning / alert** `⚠` — *(icon needed)*:
  - `organizer/components/PairingCard.tsx:228` ("⚠ Double-booked")
  - `organizer/tabs/TeamsTab.tsx:101` ("⚠ BOUNCED" email-delivery badge)
  - `organizer/tabs/ScorersTab.tsx:160` ("⚠ BOUNCED" email-delivery badge)
  - `organizer/tabs/OrganizersTab.tsx:74` ("⚠ BOUNCED" email-delivery badge)

---

## Still to make

- [ ] **Coaches** nav icon (`coach/CoachLayout.tsx:28`) — currently the only nav
  item still using a placeholder glyph (`◎`)
- [ ] **Back** arrow `←`
- [ ] **Next / proceed** arrow `→`
- [ ] **Drill-in** arrow `→` (may reuse the proceed arrow)
- [ ] **Move up / down** `↑` `↓`
- [ ] **Check / success** `✓`
- [ ] **Close** `✕`
- [ ] **Add** `+`
- [ ] **Warning** `⚠`

## Wired in

- [x] All organizer sidebar nav icons → `/icons/*.svg`
  (`organizer/pages/TournamentDashboard.tsx`), incl. **Structure → Settings.svg**
- [x] Coach sidebar nav icons → `/icons/*.svg` (`coach/CoachLayout.tsx`), incl.
  **Field → Teams.svg** (Coaches still pending)
- [x] Sidebar collapse control → `Shrink.svg` / `Expand.svg`
  (`shared/components/DashboardSidebar.tsx`)
- [x] Download ballot → `Download.svg` (`organizer/components/PairingCard.tsx`)
- [x] CSV upload label → `Upload.svg` (`shared/components/CsvImportModal.tsx`)
- [x] Coach notifications toggle → `Notifications-Enabled.svg` /
  `Notifications-Disabled.svg` (`coach/pages/CoachesPage.tsx`), backed by
  `POST /coach/teams/:teamId/coaches/:coachId/toggle-notifications` via the
  `toggleNotifications` context mutation

---

## Notes

- Icons render via the shared `<Icon name="…">` component
  (`shared/components/Icon.tsx`): it masks `/icons/{name}.svg` and fills with
  `var(--text)` by default (`.app-icon`). This is why icons recolor with the
  theme instead of showing their own fills. New icons just need a name string.
  `DashboardNavItem.icon` is that name string.
- `frontend/public/icons.svg` (singular, at the public root) is used elsewhere
  and is unrelated to the `public/icons/` folder consumed here.
- Remove/delete row actions use the text label "Remove" via `DangerButton`
  (not a glyph) and are excluded here. `DangerButton` documents an `icon` variant
  (`shared/components/DangerButton.tsx:12`) — add its glyph if used.
- Line numbers are point-in-time; if files shift, re-grep the glyph to relocate.
