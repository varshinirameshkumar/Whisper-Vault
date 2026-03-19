import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { secretService } from '../api/secretService'
import SecretCard from '../components/SecretCard'
import Navbar from '../components/Navbar'

export default function Sent() {
  const [secrets, setSecrets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all') // all | unread | burned

  useEffect(() => {
    secretService.getSent()
      .then(setSecrets)
      .catch(() => toast.error('Failed to load sent secrets'))
      .finally(() => setLoading(false))
  }, [])

  const counts = {
    all:    secrets.length,
    unread: secrets.filter(s => !s.burned).length,
    burned: secrets.filter(s => s.burned).length,
  }

  const visible = filter === 'all'
    ? secrets
    : filter === 'unread'
    ? secrets.filter(s => !s.burned)
    : secrets.filter(s => s.burned)

  return (
    <div>
      <Navbar
        title="Sent Secrets"
        subtitle={`${counts.unread} awaiting read · ${counts.burned} burned`}
      />

      <div style={{ padding: '32px 40px', maxWidth: 720 }}>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, marginBottom: 28,
        }}>
          {[
            { key: 'all',    label: 'Total Sent', color: 'var(--text-1)' },
            { key: 'unread', label: 'Awaiting',   color: 'var(--accent)' },
            { key: 'burned', label: 'Burned',      color: 'var(--text-3)' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="vv-card"
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                background: filter === key ? 'var(--bg-2)' : 'var(--bg-1)',
                border: `1px solid ${filter === key ? 'var(--border-hover)' : 'var(--border)'}`,
                textAlign: 'left',
              }}
            >
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--text-3)', letterSpacing: 2,
                marginBottom: 6, textTransform: 'uppercase',
              }}>
                {label}
              </div>
              <div style={{
                fontSize: 28, fontWeight: 700, color,
                fontFamily: 'var(--mono)',
              }}>
                {counts[key]}
              </div>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <div className="vault-spinner" />
          </div>
        ) : visible.length === 0 ? (
          <div className="fade-in" style={{
            textAlign: 'center', padding: '64px',
            color: 'var(--text-3)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📤</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 12,
              letterSpacing: 3, textTransform: 'uppercase',
            }}>
              {filter === 'all' ? 'No secrets sent yet' : `No ${filter} secrets`}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(s => (
              <SecretCard key={s.id} secret={s} isSent={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}