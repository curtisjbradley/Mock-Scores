import { useState } from 'react'
import { apiFetch } from '../auth'
import { validatePassword } from '../../utils/validation'
import { ValidationError } from '@mock-scores/shared'

export function useChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [pwError, setPwError] = useState('')
    const [pwSuccess, setPwSuccess] = useState('')
    const [submitted, setSubmitted] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitted(true)
        setPwError(''); setPwSuccess('')
        if (!currentPassword || !newPassword || !confirmPassword) return
        try {
            validatePassword(newPassword)
        } catch (err) {
            if (err instanceof ValidationError) { setPwError(err.message); return }
            throw err
        }
        if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
        apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
            .then(r => r.json().then(d => ({ ok: r.ok, message: d.message })))
            .then(({ ok, message }) => {
                if (!ok) { setPwError(message); return }
                setPwSuccess('Password updated successfully')
                setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSubmitted(false)
            })
    }

    return {
        currentPassword, setCurrentPassword,
        newPassword, setNewPassword,
        confirmPassword, setConfirmPassword,
        pwError, pwSuccess, submitted,
        handleSubmit,
    }
}
