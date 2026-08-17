import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID, setAccessToken } from './auth'
import { API_BASE } from '../config'

interface Props {
    onSuccess: () => void
    onError: (message: string) => void
}

/**
 * Wraps GoogleOAuthProvider + GoogleLogin. On success, posts the Google
 * credential to the backend, stores the returned access token in memory
 * (the refresh token is set as an HttpOnly cookie by the server), and calls
 * `onSuccess`.
 */
export default function GoogleAuthButton({ onSuccess, onError }: Props) {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleLogin width="280" onSuccess={async (credentialResponse) => {
                if (!credentialResponse.credential) return
                const res = await fetch(`${API_BASE}/auth/google/login`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: credentialResponse.credential }),
                })
                const data = await res.json().catch(() => ({})) as { accessToken?: string; message?: string }
                if (!res.ok) { onError(data.message ?? 'Unable to sign in with Google.'); return }
                setAccessToken(data.accessToken!)
                onSuccess()
            }} onError={() => onError('Google sign-in failed.')} />
        </GoogleOAuthProvider>
    )
}
