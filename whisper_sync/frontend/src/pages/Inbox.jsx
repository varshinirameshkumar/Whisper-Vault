import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import { secretService } from '../api/secretService'
import SecretCard from '../components/SecretCard'
import SecretRevealModal from '../components/SecretRevealModal'
import Navbar from '../components/Navbar'

export default function Inbox() {
  const { refreshStats }         = useOutletContext()
  const [secrets, setSecrets]    = useState([])
  const [loading, setLoading]    = useState(true)
  const [revealed, setRevealed]  = useState(null)
  const [burning, setBurning]    = useState(null)

  const load = () => {
    secretService.getInbox()
      .then(setSecrets)
      .catch(() => toast.error('Failed to load inbox'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const burn = async (id) => {
    if (burning) return
    const confirmed = window.confirm(
      'Are you sure? This will reveal the secret and permanently destroy it. There is no undo.'
    )
    if (!confirmed) return

    setBurning(id)
    try {
      const burned = await secretService.burnSecret(id)
      setRevealed(burned)
      setSecrets(prev => prev.filter(s => s.id !== id))
      refreshStats()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reveal secret'
      if (err.response?.status === 410) {
        toast.error('This secret has already been burned or expired')
        setSecrets(prev => prev.filter(s => s.id !== id))
      } else {
        toast.error(msg)
      }
    } finally {
      setBurning(null)
    }
  }

  const unread = secrets.filter(s => !s.burned).length

  return (
    <div>
      <Navbar
        title="Inbox"
        subtitle={loading
          ? 'Loading…'
          : `${unread} secret${unread !== 1 ? 's' : ''} waiting`
        }
        actions={
          <button
            className="vv-btn vv-btn-ghost"
            onClick={load}
            style={{ fontSize: 10, padding: '6px 12px' }}
          >
            ↻ Refresh
          </button>
        }
      />

      <div style={{ padding: '32px 40px', maxWidth: 720 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div className="vault-spinner" />
          </div>
        ) : secrets.length === 0 ? (
          <div className="fade-in" style={{
            textAlign: 'center', padding: '80px 40px',
            color: 'var(--text-3)',
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📭</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 13,
              letterSpacing: 3, textTransform: 'uppercase',
            }}>
              No secrets waiting
            </div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              You're all caught up.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {secrets.map(s => (
              <div key={s.id} style={{ opacity: burning === s.id ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                <SecretCard
                  secret={s}
                  onBurn={burn}
                  isSent={false}
                />
              </div>
            ))}
          </div>
        )}

        {secrets.length > 0 && (
          <div style={{
            marginTop: 24,
            padding: '12px 16px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-glow)',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            color: 'var(--text-2)',
            fontFamily: 'var(--mono)',
            letterSpacing: 0.5,
          }}>
            ⚠ Each secret is destroyed the moment you reveal it. This action cannot be undone.
          </div>
        )}
      </div>

      {revealed && (
        <SecretRevealModal
          secret={revealed}
          onClose={() => setRevealed(null)}
        />
      )}
    </div>
  )
}