import { useEffect, useState } from 'react'
import { apiFetch, getSession, logout } from './auth'
import { validatePassword } from '../utils/validation'
import PasswordRequirements from './PasswordRequirements'
import { useNavigate } from 'react-router-dom'
import { useChangePasswordForm } from './hooks/useChangePasswordForm'
import DangerButton from '../shared/components/DangerButton'
import ModalBackdrop from '../shared/components/ModalBackdrop'
import './styles/account.css'
import '../judges/styles/modal.css'

function isPasswordInvalid(password: string): boolean {
    try { validatePassword(password); return false; } catch { return true; }
}

export function Account() {
    const [email, setEmail] = useState<string | null>(null)
    const navigate = useNavigate()
    const {
        currentPassword, setCurrentPassword,
        newPassword, setNewPassword,
        confirmPassword, setConfirmPassword,
        pwError, pwSuccess, submitted,
        handleSubmit,
    } = useChangePasswordForm()

    useEffect(() => {
        getSession().then(s => {
            if (!s) navigate('/login', { replace: true })
            else setEmail(s.email)
        })
    }, [navigate])

    const handleLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleDeleteAccount = async () => {
        setDeleting(true)
        const res = await apiFetch('/auth/account', { method: 'DELETE' })
        if (res.ok || res.status === 204) {
            await logout()
            navigate('/', { replace: true })
        } else {
            setDeleting(false)
            setShowDeleteModal(false)
        }
    }

    if (!email) return null

    return (
        <>
        <main className="account-main">
            <div className="account-card">
                <h1>Account</h1>
                <div className="account-info">
                    <span className="account-info-label">Email</span>
                    <span className="account-info-value">{email}</span>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Change password</h2>
                    {pwError && <p className="account-form-error">{pwError}</p>}
                    {pwSuccess && <p className="account-form-success">{pwSuccess}</p>}
                    <div className="account-field">
                        <label className="account-info-label" htmlFor="cur-pw">Current password</label>
                        <input id="cur-pw" type="password" className={`account-input${submitted && !currentPassword ? ' account-input--invalid' : ''}`}
                            value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                    </div>
                    <div className="account-field">
                        <label className="account-info-label" htmlFor="new-pw">New password</label>
                        <input id="new-pw" type="password" className={`account-input${submitted && newPassword.length > 0 && isPasswordInvalid(newPassword) ? ' account-input--invalid' : ''}`}
                            value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                        {newPassword && <PasswordRequirements password={newPassword} />}
                    </div>
                    <div className="account-field">
                        <label className="account-info-label" htmlFor="confirm-pw">Confirm new password</label>
                        <input id="confirm-pw" type="password" className={`account-input${submitted && confirmPassword && confirmPassword !== newPassword ? ' account-input--invalid' : ''}`}
                            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                    </div>
                    <button type="submit" className="account-submit">Update password</button>
                </form>

                <button className="account-signout" onClick={handleLogout}>Sign out</button>

                <div className="account-danger-zone">
                    <h2 className="account-danger-heading">Danger zone</h2>
                    <p className="account-danger-description">
                        Permanently delete your account and all associated data. This cannot be undone.
                    </p>
                    <DangerButton variant="solid" onClick={() => setShowDeleteModal(true)}>
                        Delete account
                    </DangerButton>
                </div>
            </div>
        </main>

        {showDeleteModal && (
            <ModalBackdrop onClose={() => setShowDeleteModal(false)} dismissible={!deleting}>
                <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
                    <h2 id="delete-account-title" style={{ margin: '0 0 0.75rem', color: '#d32f2f' }}>Delete Account</h2>
                    <p style={{ margin: '0 0 0.5rem', lineHeight: 1.6 }}>
                        Are you sure you want to permanently delete your account?
                    </p>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        All your data including tournaments, teams, and scoring history will be permanently removed. This action cannot be undone.
                    </p>
                    <div className="confirm-actions">
                        <button onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
                        <button onClick={handleDeleteAccount} disabled={deleting} style={{ backgroundColor: '#d32f2f', color: '#fff' }}>
                            {deleting ? 'Deleting…' : 'Permanently Delete'}
                        </button>
                    </div>
                </div>
            </ModalBackdrop>
        )}
        </>
    )
}
