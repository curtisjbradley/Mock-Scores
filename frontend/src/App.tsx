import './App.css'

import {BrowserRouter, Route, Routes} from "react-router-dom";
import Home from "./Home.tsx";
import NotFound from "./NotFound.tsx";


import { lazy, Suspense } from 'react';

const ScoreSheetHome = lazy(() => {
    return import('./judges/components/ScoreSheetHome.tsx');
});


function App() {



  return (
      <BrowserRouter>
      <Routes>
        <Route index  element={<Home />}/>
        <Route path={"/score/:scorerID"} element={ <Suspense fallback={<div>Loading...</div>}> <ScoreSheetHome/></Suspense>} />
        <Route path={"*"} element={<NotFound />} />
      </Routes>
      </BrowserRouter>

  )
}

export default App
