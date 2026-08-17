import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isValidEmail, validatePassword } from '../../utils/validation'
import { ValidationError } from '@mock-scores/shared'
import { postJson } from '../auth'

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
        try {
            validatePassword(password)
        } catch (err) {
            if (err instanceof ValidationError) { setError(err.message); return }
            throw err
        }
        try {
            const { ok, data } = await postJson<{ message?: string }>('/auth/register', {
                firstName: firstName.trim(), lastName: lastName.trim(), email, password,
            })
            if (!ok) { setError(data.message ?? 'Registration failed.'); return }
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
