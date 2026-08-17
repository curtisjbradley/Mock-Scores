import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { postJson } from './auth'
import './styles/auth-form.css'

const VerifyEmail = () => {
    const [params] = useSearchParams()
    const token = params.get('token')

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error')
    const [message, setMessage] = useState(token ? '' : 'No verification token provided.')

    useEffect(() => {
        if (!token) return

        postJson<{ message: string }>('/auth/verify-email', { token })
            .then(({ ok, data }) => {
                if (ok) {
                    setStatus('success')
                    setMessage(data?.message ?? 'Email verified successfully!')
                } else {
                    setStatus('error')
                    setMessage(data?.message ?? 'Verification failed. The link may be invalid or expired.')
                }
            })
            .catch(() => {
                setStatus('error')
                setMessage('Something went wrong. Please try again later.')
            })
    }, [token])

    return (
        <main className="auth-main">
            <div className="auth-card">
                {status === 'loading' && (
                    <>
                        <h1>Verifying your email…</h1>
                        <p style={{ lineHeight: 1.6, margin: '0.5rem 0 1.5rem' }}>
                            Please wait while we verify your email address.
                        </p>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <h1>Email verified!</h1>
                        <p style={{ lineHeight: 1.6, margin: '0.5rem 0 1.5rem' }}>
                            {message}
                        </p>
                        <Link to="/login" className="auth-link-back">Go to sign in</Link>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <h1>Verification failed</h1>
                        <p style={{ lineHeight: 1.6, margin: '0.5rem 0 1.5rem' }}>
                            {message}
                        </p>
                        <Link to="/login" className="auth-link-back">Go to sign in</Link>
                    </>
                )}
            </div>
        </main>
    )
}

export default VerifyEmail
