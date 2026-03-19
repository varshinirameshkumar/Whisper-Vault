import React, { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authService } from '../api/authService'
import { AuthContext } from '../App'

export default function Login() {
  const { setUser }  = useContext(AuthContext)
  const navigate     = useNavigate()
  const [form, setForm]     = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await authService.login(form.username, form.password)
      setUser(user)
      toast.success(`Welcome back, ${user.displayName || user.username}`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials')
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
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        opacity: 0.3,
      }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{
            fontFamily: 'var(--mono)', fontWeight: 700,
            letterSpacing: 5, lineHeight: 1.1,
          }}>
            <div style={{ fontSize: 30, color: 'var(--accent)' }}>⚡</div>
            <div style={{ fontSize: 26, color: 'var(--text-1)', marginTop: 6 }}>WHISPER</div>
            <div style={{ fontSize: 26, color: 'var(--text-1)' }}>VAULT</div>
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)',
            letterSpacing: 4, marginTop: 10, textTransform: 'uppercase',
          }}>
            Secrets that disappear
          </div>
        </div>

        {/* Card */}
        <div className="vv-card" style={{ padding: '32px' }}>
          <h2 style={{
            fontSize: 16, fontWeight: 600, marginBottom: 24,
            fontFamily: 'var(--mono)', letterSpacing: 2,
            color: 'var(--text-2)', textTransform: 'uppercase',
          }}>
            Sign In
          </h2>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontFamily: 'var(--mono)',
                color: 'var(--text-3)', letterSpacing: 2, marginBottom: 7, textTransform: 'uppercase',
              }}>Username</label>
              <input
                className="vv-input"
                type="text"
                value={form.username}
                onChange={set('username')}
                required
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontFamily: 'var(--mono)',
                color: 'var(--text-3)', letterSpacing: 2, marginBottom: 7, textTransform: 'uppercase',
              }}>Password</label>
              <input
                className="vv-input"
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="vv-btn vv-btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 8, padding: '12px', letterSpacing: 3 }}
            >
              {loading ? 'Authenticating...' : 'Enter Vault'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, color: 'var(--text-3)', fontSize: 13 }}>
          No vault?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
