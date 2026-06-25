import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isValidEmail, validatePassword } from '../../utils/validation'

export function useRegisterForm() {
    const navigate = useNavigate()
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return }
        if (password !== confirm) { setError('Passwords do not match.'); return }
        const pwError = validatePassword(password)
        if (pwError) { setError(pwError); return }
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email, password }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.message ?? 'Registration failed.')
                return
            }
            navigate('/login')
        } catch {
            setError('Something went wrong. Please try again.')
        }
    }

    const handleGoogleSuccess = () => navigate('/')

    return {
        firstName, setFirstName, lastName, setLastName,
        email, setEmail, password, setPassword, confirm, setConfirm,
        error, setError, handleSubmit, handleGoogleSuccess,
    }
}
