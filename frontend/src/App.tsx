import './App.css'

import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from 'react';
import Home from "./Home.tsx";
import NotFound from "./NotFound.tsx";
import Forbidden from "./Forbidden.tsx";
import About from "./About.tsx";
import Login from "./Login.tsx";
import Register from "./Register.tsx";
import OrganizerHome from "./organizer/OrganizerHome.tsx";
import OrganizerLogin from "./organizer/OrganizerLogin.tsx";
import TournamentDashboard from "./organizer/TournamentDashboard.tsx";
import ScorecardViewer from "./organizer/ScorecardViewer.tsx";
import RoundView from "./organizer/RoundView.tsx";
import CoachLogin from "./coach/CoachLogin.tsx";
import CoachHome from "./coach/CoachHome.tsx";
import CoachDashboard from "./coach/CoachDashboard.tsx";import LoadingPage from "./components/LoadingPage.tsx";

const ScoreSheetHome = lazy(() => import('./judges/components/ScoreSheetHome.tsx'));

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route index element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/403" element={<Forbidden />} />
          <Route path="/organizer" element={<OrganizerLogin />} />
          <Route path="/organizer/select" element={<OrganizerHome />} />
          <Route path="/organizer/:id" element={<TournamentDashboard />} />
          <Route path="/organizer/:id/round/:round" element={<RoundView />} />
          <Route path="/organizer/:id/school/:schoolId" element={<CoachDashboard isOrganizerView />} />
          <Route path="/organizer/:id/scoresheet/:pairingId/:judgeId" element={<ScorecardViewer />} />
          <Route path="/coach" element={<CoachLogin />} />
          <Route path="/coach/select" element={<CoachHome />} />
          <Route path="/coach/:id" element={<CoachDashboard />} />
          <Route path="/score/:scorerID" element={
            <Suspense fallback={<LoadingPage />}>
              <ScoreSheetHome />
            </Suspense>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
  )
}

export default App
