import React, { useState, useContext, useEffect } from 'react'
import { useOutletContext, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthContext } from '../App'
import { secretService } from '../api/secretService'
import SearchBar from '../components/SearchBar'
import Navbar from '../components/Navbar'

const EXPIRY_OPTIONS = [
  { value: 1,   label: '1h' },
  { value: 6,   label: '6h' },
  { value: 24,  label: '24h' },
  { value: 72,  label: '3d' },
  { value: 168, label: '7d' },
]

const EMPTY_FORM = { subject: '', content: '', expiryHours: 24 }

export default function Dashboard() {
  const { user }                   = useContext(AuthContext)
  const { refreshStats }           = useOutletContext()
  const location                   = useLocation()
  const [recipient, setRecipient]  = useState(location.state?.recipient || null)
  const [form, setForm]            = useState(EMPTY_FORM)
  const [loading, setLoading]      = useState(false)
  const [success, setSuccess]      = useState(false)

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }))

  const reset = () => {
    setForm(EMPTY_FORM)
    setRecipient(null)
    setSuccess(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!recipient) { toast.error('Please select a recipient'); return }
    if (!form.content.trim()) { toast.error('Message cannot be empty'); return }
    setLoading(true)
    try {
      await secretService.sendSecret({ ...form, recipientUsername: recipient.username })
      setSuccess(true)
      refreshStats()
      toast.success('Secret encrypted and transmitted')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send secret')
    } finally {
      setLoading(false)
    }
  }

  const charCount = form.content.length
  const charPct   = (charCount / 10000) * 100

  if (success) {
    return (
      <div>
        <Navbar title={`Hello, ${user?.displayName || user?.username}`} />
        <div style={{ padding: '48px 40px', maxWidth: 640 }}>
          <div className="fade-in vv-card" style={{
            padding: '56px 40px',
            textAlign: 'center',
            border: '1px solid var(--accent)',
            boxShadow: '0 0 40px var(--accent-glow)',
          }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>🔐</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 18,
              color: 'var(--accent)', letterSpacing: 3, marginBottom: 10,
            }}>
              TRANSMITTED
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 6 }}>
              Your secret is encrypted and waiting for
            </div>
            <div style={{
              fontFamily: 'var(--mono)', color: 'var(--text-1)',
              fontSize: 15, marginBottom: 32,
            }}>
              @{recipient?.username}
            </div>
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
            }}>
              {[
                { icon: '🔒', text: 'AES-256-GCM encrypted' },
                { icon: '🔥', text: 'Burns on first read' },
                { icon: '💀', text: `Expires in ${form.expiryHours}h` },
              ].map(({ icon, text }) => (
                <span key={text} style={{
                  padding: '6px 14px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  fontSize: 12,
                  color: 'var(--text-2)',
                  fontFamily: 'var(--mono)',
                }}>
                  {icon} {text}
                </span>
              ))}
            </div>
            <button
              className="vv-btn vv-btn-ghost"
              onClick={reset}
              style={{ marginTop: 32 }}
            >
              Send Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Navbar
        title={`Hello, ${user?.displayName || user?.username}`}
        subtitle="Compose an encrypted secret. It self-destructs the moment it's read."
      />
      <div style={{ padding: '32px 40px', maxWidth: 660 }}>
        <form onSubmit={submit}>
          <div className="vv-card" style={{ padding: '28px' }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 3,
              color: 'var(--text-3)', marginBottom: 24, textTransform: 'uppercase',
            }}>
              New Secret
            </div>

            {/* Recipient */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Recipient</label>
              <SearchBar
                onSelect={setRecipient}
                selectedUser={recipient}
                onClear={() => setRecipient(null)}
              />
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>
                Subject <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                className="vv-input"
                type="text"
                value={form.subject}
                onChange={set('subject')}
                placeholder="Hint for the recipient…"
                maxLength={100}
              />
            </div>

            {/* Content */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Secret Message</label>
              <textarea
                className="vv-input"
                value={form.content}
                onChange={set('content')}
                required
                placeholder="Your encrypted secret… (AES-256-GCM)"
                rows={7}
                maxLength={10000}
                style={{ resize: 'vertical', fontFamily: 'var(--mono)', lineHeight: 1.75 }}
              />
              {/* Character bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <div style={{
                  flex: 1, height: 2, background: 'var(--border)',
                  borderRadius: 2, marginRight: 10, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${charPct}%`,
                    background: charPct > 90 ? 'var(--danger)' : 'var(--accent)',
                    transition: 'width 0.1s ease',
                  }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-3)' }}>
                  {charCount.toLocaleString()} / 10,000
                </span>
              </div>
            </div>

            {/* Expiry timer */}
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Self-Destruct Timer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, expiryHours: opt.value }))}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 6,
                      border: `1px solid ${form.expiryHours === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.expiryHours === opt.value ? 'var(--accent)' : 'var(--bg-2)',
                      color: form.expiryHours === opt.value ? '#000' : 'var(--text-2)',
                      fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', transition: 'all var(--transition)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', marginTop: 6 }}>
                Auto-purged by MongoDB TTL after {form.expiryHours}h if unread
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="vv-btn vv-btn-primary"
              disabled={loading || !recipient}
              style={{ width: '100%', padding: '13px', letterSpacing: 3, fontSize: 13 }}
            >
              {loading ? 'Encrypting…' : '🔐 Encrypt & Send'}
            </button>
          </div>
        </form>

        {/* Security callouts */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 10, marginTop: 16,
        }}>
          {[
            { icon: '🔒', title: 'AES-256-GCM', sub: 'Military-grade encryption at rest' },
            { icon: '🔥', title: 'Burn on Read', sub: 'Deleted atomically on first view' },
            { icon: '⏱',  title: 'TTL Purge',   sub: 'MongoDB auto-purges expired docs' },
            { icon: '🛡',  title: 'Tab Shield',  sub: 'Content hidden when unfocused' },
          ].map(({ icon, title, sub }) => (
            <div key={title} className="vv-card" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 10,
  fontFamily: 'var(--mono)',
  color: 'var(--text-3)',
  letterSpacing: 2,
  marginBottom: 8,
  textTransform: 'uppercase',
  fontWeight: 700,
}