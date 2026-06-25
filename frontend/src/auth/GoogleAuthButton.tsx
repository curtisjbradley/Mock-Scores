import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID, saveToken, apiFetch } from './auth'

interface Props {
    onSuccess: (token: string) => void
    onError: (message: string) => void
}

/** Wraps GoogleOAuthProvider + GoogleLogin into a single reusable component. */
export default function GoogleAuthButton({ onSuccess, onError }: Props) {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleLogin onSuccess={async (credentialResponse) => {
                if (!credentialResponse.credential) return
                const res = await apiFetch('/api/auth/google/login', {
                    method: 'POST',
                    body: JSON.stringify({ token: credentialResponse.credential }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) { onError(data.message ?? 'Unable to sign in with Google.'); return }
                saveToken(data.token)
                onSuccess(data.token)
            }} />
        </GoogleOAuthProvider>
    )
}
