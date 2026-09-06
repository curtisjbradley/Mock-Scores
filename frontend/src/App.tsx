import './styles/globals.css'

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy } from 'react';
import Layout from "./layout/Layout.tsx";
import ProtectedRoute from "./layout/ProtectedRoute.tsx";

const Home = lazy(() => import('./Home.tsx'));
const NotFound = lazy(() => import('./error/NotFound.tsx'));
const Forbidden = lazy(() => import('./error/Forbidden.tsx'));
const OrganizerHome = lazy(() => import('./organizer/pages/OrganizerHome.tsx'));
const TournamentDashboard = lazy(() => import('./organizer/pages/TournamentDashboard.tsx'));
const TournamentNew = lazy(() => import('./organizer/pages/TournamentNew.tsx'));
const ScorecardViewer = lazy(() => import('./organizer/pages/ScorecardViewer.tsx'));
const RoundView = lazy(() => import('./organizer/pages/RoundView.tsx'));
const BallotPage = lazy(() => import('./organizer/pages/BallotPage.tsx'));
const CombinedScoresheetPage = lazy(() => import('./shared/components/CombinedScoresheetPage.tsx'));
const CoachHome = lazy(() => import('./coach/CoachHome.tsx'));
const CoachLayout = lazy(() => import('./coach/CoachLayout'));
const OverviewPage = lazy(() => import('./coach/pages/OverviewPage.tsx'));
const SchedulePage = lazy(() => import('./coach/pages/SchedulePage.tsx'));
const ResultsPage = lazy(() => import('./coach/pages/ResultsPage.tsx'));
const CoachesPage = lazy(() => import('./coach/pages/CoachesPage.tsx'));
const RosterPage = lazy(() => import('./coach/pages/RosterPage.tsx'));
const FieldPage = lazy(() => import('./coach/pages/FieldPage.tsx'));
const StandingsPage = lazy(() => import('./coach/pages/StandingsPage.tsx'));
const AssignRoles = lazy(() => import('./coach/pages/AssignRoles.tsx'));
const WitnessCallOrder = lazy(() => import('./coach/pages/WitnessCallOrder.tsx'));
const Account = lazy(() => import('./auth/Account.tsx').then(m => ({ default: m.Account })));
const LoginPage = lazy(() => import('./auth/LoginPage.tsx'));
const Register = lazy(() => import('./auth/Register.tsx'));
const ForgotPassword = lazy(() => import('./auth/ForgotPassword.tsx'));
const ResetPassword = lazy(() => import('./auth/ResetPassword.tsx'));
const VerifyEmail = lazy(() => import('./auth/VerifyEmail.tsx'));
const ScoreSheetHome = lazy(() => import('./judges/components/ScoreSheetHome.tsx'));
const Help = lazy(() => import('./help/Help.tsx'));


function App() {
  return (
      <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>

              <Route index element={<Home />} />

              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<Register />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="verify-email" element={<VerifyEmail />} />
              <Route path="account" element={<Account />} />

              <Route path="organizer" element={<ProtectedRoute />}>
                  <Route index element={<OrganizerHome />} />
                  <Route path="new" element={<TournamentNew />} />
                  <Route path=":id" element={<TournamentDashboard />} />
                  <Route path=":id/round/:round" element={<RoundView />} />
                  <Route path=":id/school/:schoolId" element={<CoachLayout isOrganizerView />}>
                      <Route index element={<Navigate to="overview" replace />} />
                      <Route path="overview" element={<OverviewPage />} />
                      <Route path="schedule" element={<SchedulePage />} />
                      <Route path="results" element={<ResultsPage />} />
                      <Route path="coaches" element={<CoachesPage />} />
                      <Route path="roster" element={<RosterPage />} />
                      <Route path="field" element={<FieldPage />} />
                      <Route path="standings" element={<StandingsPage />} />
                  </Route>
                  <Route path=":id/school/:teamId/assign-roles/:pairingId/:side" element={<AssignRoles />} />
                  <Route path=":id/school/:teamId/witness-order/:pairingId" element={<WitnessCallOrder />} />
                  <Route path=":id/scoresheet/:pairingId/:judgeId" element={<ScorecardViewer />} />
                  <Route path=":id/round/:round/pairing/:pairingId/scoresheet" element={<CombinedScoresheetPage />} />
                  <Route path=":id/*" element={<NotFound />} />

              </Route>

              <Route path="coach" element={<ProtectedRoute />}>
                <Route index element={<CoachHome />} />
                <Route path=":teamId/assign-roles/:pairingId/:side" element={<AssignRoles />} />
                <Route path=":teamId/witness-order/:pairingId" element={<WitnessCallOrder />} />
                <Route path=":teamId/ballot/:pairingId/:assignmentId" element={<ScorecardViewer />} />
                <Route path=":teamId/pairing/:pairingId/scoresheet" element={<CombinedScoresheetPage />} />
                <Route path=":teamId" element={<CoachLayout />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<OverviewPage />} />
                    <Route path="schedule" element={<SchedulePage />} />
                    <Route path="results" element={<ResultsPage />} />
                    <Route path="coaches" element={<CoachesPage />} />
                    <Route path="roster" element={<RosterPage />} />
                    <Route path="field" element={<FieldPage />} />
                    <Route path="standings" element={<StandingsPage />} />
                </Route>
                  <Route path=":teamId/*" element={<NotFound />} />
              </Route>

                <Route path={"help"} element={<ProtectedRoute/>} >
                    <Route index element={<Help />}/>
                </Route>


              <Route path="403" element={<Forbidden />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="/score/:scorerID" element={<ScoreSheetHome />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/organizer/:id/round/:round/ballot/:pairingId" element={<BallotPage />} />
            </Route>
          </Routes>
      </BrowserRouter>
  )
}

export default App
