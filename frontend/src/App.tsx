import './styles/globals.css'

import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from 'react';
import Layout from "./layout/Layout.tsx";
import LoadingPage from "./layout/LoadingPage.tsx";
import ProtectedRoute from "./layout/ProtectedRoute.tsx";

const Home = lazy(() => import('./Home.tsx'));
const NotFound = lazy(() => import('./error/NotFound.tsx'));
const Forbidden = lazy(() => import('./error/Forbidden.tsx'));
const About = lazy(() => import('./About.tsx'));
const OrganizerHome = lazy(() => import('./organizer/OrganizerHome.tsx'));
const TournamentDashboard = lazy(() => import('./organizer/TournamentDashboard.tsx'));
const TournamentCreate = lazy(() => import('./organizer/TournamentCreate.tsx'));
const ScorecardViewer = lazy(() => import('./organizer/ScorecardViewer.tsx'));
const RoundView = lazy(() => import('./organizer/RoundView.tsx'));
const CoachHome = lazy(() => import('./coach/CoachHome.tsx'));
const CoachDashboard = lazy(() => import('./coach/CoachDashboard.tsx'));
const Account = lazy(() => import('./auth/Account.tsx').then(m => ({ default: m.Account })));
const LoginPage = lazy(() => import('./auth/LoginPage.tsx'));
const Register = lazy(() => import('./auth/Register.tsx'));
const ScoreSheetHome = lazy(() => import('./judges/components/ScoreSheetHome.tsx'));

const fallback = <LoadingPage />;

function App() {
  return (
      <BrowserRouter>
        <Suspense fallback={fallback}>
          <Routes>
            <Route element={<Layout />}>

              <Route index element={<Home />} />

              <Route path="login" element={<LoginPage title="Sign in" redirect="/organizer" footerLink={{ text: "Don't have an account?", label: "Register", to: "/register" }} />} />
              <Route path="register" element={<Register />} />
              <Route path="account" element={<Account />} />

              <Route path="organizer" element={<ProtectedRoute />}>
                  <Route index element={<OrganizerHome />} />
                  <Route path="new" element={<TournamentCreate />} />
                  <Route path=":id" element={<TournamentDashboard />} />
                  <Route path=":id/round/:round" element={<RoundView />} />
                  <Route path=":id/school/:schoolId" element={<CoachDashboard isOrganizerView />} />
                  <Route path=":id/scoresheet/:pairingId/:judgeId" element={<ScorecardViewer />} />
                  <Route path=":id/*" element={<NotFound />} />

              </Route>

              <Route path="coach" element={<ProtectedRoute />}>
                <Route index element={<CoachHome />} />
                <Route path=":id" element={<CoachDashboard />} />
                  <Route path=":id/*" element={<NotFound />} />
              </Route>

              <Route path="about" element={<About />} />
              <Route path="403" element={<Forbidden />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="/score/:scorerID" element={<ScoreSheetHome />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
  )
}

export default App
