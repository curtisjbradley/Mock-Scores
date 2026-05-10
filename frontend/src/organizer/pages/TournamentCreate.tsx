import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/organizer.css'
import '../styles/tournament-create.css'

interface FormState {
    name: string
    location: string
    startDate: string
    endDate: string
    rounds: string
    teams: string
}

const empty: FormState = { name: '', location: '', startDate: '', endDate: '', rounds: '', teams: '' }

const TournamentCreate = () => {
    const navigate = useNavigate()
    const [form, setForm] = useState<FormState>(empty)
    const [submitted, setSubmitted] = useState(false)

    const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }))

    const errors = {
        name:      !form.name.trim()                                   ? 'Required'              : '',
        location:  !form.location.trim()                               ? 'Required'              : '',
        startDate: !form.startDate                                     ? 'Required'              : '',
        endDate:   !form.endDate                                       ? 'Required'
                 : form.endDate < form.startDate                       ? 'Must be after start'   : '',
        rounds:    !form.rounds || Number(form.rounds) < 1             ? 'At least 1 round'      : '',
        teams:     !form.teams  || Number(form.teams)  < 2             ? 'At least 2 teams'      : '',
    }

    const valid = Object.values(errors).every(e => !e)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitted(true)
        if (!valid) return
        // TODO: POST /api/tournaments with form data, navigate to returned tournament id
        // TODO: persist — for now navigate back with a fake id
        const newId = `t-new-${Date.now()}`
        navigate(`/organizer/${newId}`)
    }

    const field = (label: string, key: keyof FormState, type = 'text', extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
        <div className="tc-field">
            <label className="tc-label" htmlFor={key}>{label}</label>
            <input
                id={key}
                type={type}
                className={`tc-input${submitted && errors[key] ? ' tc-input--invalid' : ''}`}
                value={form[key]}
                onChange={set(key)}
                {...extra}
            />
            {submitted && errors[key] && <span className="rv-field-error">{errors[key]}</span>}
        </div>
    )

    return (


            <main className="org-main">
                <div className="org-container">
                    <button className="org-back-btn" onClick={() => navigate('/organizer')}>← All tournaments</button>
                    <div className="org-header">
                        <h1>New tournament</h1>
                    </div>

                    <form className="tc-form" onSubmit={handleSubmit} noValidate>
                        {field('Tournament name', 'name', 'text', { placeholder: 'e.g. Bay Area Invitational 2027', autoFocus: true })}
                        {field('Location', 'location', 'text', { placeholder: 'e.g. San Francisco, CA' })}

                        <div className="tc-row">
                            {field('Start date', 'startDate', 'date')}
                            {field('End date', 'endDate', 'date')}
                        </div>

                        <div className="tc-row">
                            {field('Rounds', 'rounds', 'number', { min: 1, max: 20, placeholder: '4' })}
                            {field('Teams', 'teams', 'number', { min: 2, max: 256, placeholder: '24' })}
                        </div>

                        <div className="tc-actions">
                            <button type="button" className="tc-cancel-btn" onClick={() => navigate('/organizer/select')}>Cancel</button>
                            <button type="submit" className="org-new-btn">Create tournament</button>
                        </div>
                    </form>
                </div>
            </main>


    )
}

export default TournamentCreate
