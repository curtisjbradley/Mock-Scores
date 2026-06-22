import './styles/auth-form.css'

const REQUIREMENTS = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'At least one uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'At least one number', test: (p: string) => /[0-9]/.test(p) },
]

const PasswordRequirements = ({ password }: { password: string }) => (
    <ul className="pw-requirements">
        {REQUIREMENTS.map(({ label, test }) => (
            <li key={label} className={test(password) ? 'pw-req--met' : 'pw-req--unmet'}>
                {label}
            </li>
        ))}
    </ul>
)

export default PasswordRequirements
