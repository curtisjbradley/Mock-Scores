import { Outlet } from 'react-router-dom'
import './styles/layout.css'
import Header from './Header'
import Footer from './Footer'
import {Suspense} from "react";
import LoadingPage from "./LoadingPage.tsx";

const Layout = () => (
    <>
        <Header />
        <Suspense fallback={<LoadingPage loadingText={'Loading Page...'} />}>
                <Outlet />
            </Suspense>
        <Footer />
    </>
)

export default Layout
