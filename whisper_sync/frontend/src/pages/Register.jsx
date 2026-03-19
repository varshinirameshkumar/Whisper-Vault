import React, { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authService } from '../api/authService'
import { AuthContext } from '../App'

const FIELDS = [
  { key: 'username',    label: 'Username',     type: 'text',     required: true,  hint: '3–30 characters' },
  { key: 'displayName', label: 'Display Name', type: 'text',     required: false, hint: 'Optional — shown to others' },
  { key: 'email',       label: 'Email',        type: 'email',    required: true,  hint: 'For security notifications' },
  { key: 'password',    label: 'Password',     type: 'password', required: true,  hint: 'Minimum 8 characters' },
]

export default function Register() {
  const { setUser }  = useContext(AuthContext)
  const navigate     = useNavigate()
  const [form, setForm]     = useState({ username: '', displayName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const user = await authService.register(form)
      setUser(user)
      toast.success('Vault created. Welcome aboard.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-0)',
      padding: 24,
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.3,
      }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: 5 }}>
            <span style={{ fontSize: 22, color: 'var(--accent)' }}>⚡</span>
            <span style={{ fontSize: 22, color: 'var(--text-1)' }}> WHISPER VAULT</span>
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)',
            letterSpacing: 4, marginTop: 8,
          }}>
            CREATE YOUR VAULT
          </div>
        </div>

        <div className="vv-card" style={{ padding: '32px' }}>
          <h2 style={{
            fontSize: 16, fontFamily: 'var(--mono)', letterSpacing: 2,
            color: 'var(--text-2)', marginBottom: 24, textTransform: 'uppercase',
          }}>
            New Account
          </h2>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FIELDS.map(({ key, label, type, required, hint }) => (
              <div key={key}>
                <label style={{
                  display: 'block', fontSize: 10, fontFamily: 'var(--mono)',
                  color: 'var(--text-3)', letterSpacing: 2,
                  marginBottom: 6, textTransform: 'uppercase',
                }}>
                  {label}
                  {!required && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>(optional)</span>}
                </label>
                <input
                  className="vv-input"
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  required={required}
                  autoComplete={key === 'password' ? 'new-password' : key}
                />
                {hint && (
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                    {hint}
                  </div>
                )}
              </div>
            ))}

            <button
              type="submit"
              className="vv-btn vv-btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 10, padding: '12px', letterSpacing: 3 }}
            >
              {loading ? 'Creating Vault...' : 'Create Vault'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, color: 'var(--text-3)', fontSize: 13 }}>
          Already have a vault?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
