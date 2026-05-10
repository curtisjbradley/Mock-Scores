import { Navigate } from 'react-router-dom'

// Legacy /auth/:pathname route — redirect to the dedicated login page.
export function Auth() {
    return <Navigate to="/login" replace />
}

export default Auth
