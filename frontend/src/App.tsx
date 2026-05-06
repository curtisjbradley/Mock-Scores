import './App.css'

import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from 'react';
import Home from "./Home.tsx";
import NotFound from "./NotFound.tsx";
import LoadingPage from "./components/LoadingPage.tsx";

const ScoreSheetHome = lazy(() => import('./judges/components/ScoreSheetHome.tsx'));

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route index element={<Home />} />
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
