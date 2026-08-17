import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setAccessToken, postJson } from '../auth'
import { isValidEmail } from '../../utils/validation'

/**
 * Form state and submission logic for the login page.
 *
 * On successful login, stores the short-lived access token in memory via
 * `setAccessToken`. The server sets the HttpOnly refresh cookie automatically.
 */
export function useLoginForm() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const redirect = searchParams.get('redirect') ?? '/'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return }
        try {
            const { ok, data } = await postJson<{ accessToken?: string; message?: string }>(
                '/auth/login',
                { email, password },
            )
            if (!ok) { setError(data.message ?? 'Invalid email or password.'); return }
            setAccessToken(data.accessToken!)
            navigate(redirect)
        } catch {
            setError('Something went wrong. Please try again.')
        }
    }

    const handleGoogleSuccess = () => navigate(redirect)

    return { email, setEmail, password, setPassword, error, setError, handleSubmit, handleGoogleSuccess }
}
