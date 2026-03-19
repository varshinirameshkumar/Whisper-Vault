import React from 'react'
import { formatDistanceToNow, format } from 'date-fns'

const STATUS = {
  burned:  { label: 'BURNED',  bg: 'rgba(80,80,80,0.15)', color: 'var(--text-3)', border: 'var(--border)' },
  unread:  { label: 'UNREAD',  bg: 'var(--accent-dim)',   color: 'var(--accent)', border: 'var(--accent-glow)' },
  sent:    { label: 'SENT',    bg: 'var(--success-dim)',  color: 'var(--success)', border: 'rgba(61,220,132,0.2)' },
}

export default function SecretCard({ secret, onBurn, isSent }) {
  const now       = new Date()
  const created   = new Date(secret.createdAt)
  const expires   = secret.expiresAt ? new Date(secret.expiresAt) : null
  const isExpired = expires && now > expires && !secret.burned
  const timeAgo   = formatDistanceToNow(created, { addSuffix: true })

  const statusKey = secret.burned ? 'burned' : isSent ? 'sent' : 'unread'
  const status    = STATUS[statusKey]

  const getExpiryLabel = () => {
    if (secret.burned && secret.burnedAt) {
      return `Burned ${formatDistanceToNow(new Date(secret.burnedAt), { addSuffix: true })}`
    }
    if (isExpired) return 'Expired'
    if (expires) {
      const hrs = Math.max(0, Math.round((expires - now) / 3600000))
      if (hrs < 1) return 'Expires in < 1 hour'
      if (hrs < 24) return `Expires in ${hrs}h`
      return `Expires ${formatDistanceToNow(expires, { addSuffix: true })}`
    }
    return null
  }

  const expiryLabel  = getExpiryLabel()
  const expiryUrgent = expires && !secret.burned && ((expires - now) / 3600000) < 3

  return (
    <div className="vv-card fade-in" style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        {/* Left */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* From/To tag */}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 2,
            color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase',
          }}>
            {isSent
              ? <>To: <span style={{ color: 'var(--text-2)' }}>@{secret.recipientUsername}</span></>
              : <>From: <span style={{ color: 'var(--text-2)' }}>@{secret.senderUsername}</span></>
            }
          </div>

          {/* Subject */}
          <div style={{
            fontSize: 15, fontWeight: 600, color: 'var(--text-1)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {secret.subject || 'Untitled Secret'}
          </div>

          {/* Meta row */}
          <div style={{
            display: 'flex', gap: 14, marginTop: 8,
            fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)',
            flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span title={format(created, 'PPpp')}>⏱ {timeAgo}</span>
            {expiryLabel && (
              <span style={{ color: expiryUrgent ? '#ff8844' : 'var(--text-3)' }}>
                {secret.burned ? '🔥' : isExpired ? '💀' : expiryUrgent ? '⚠' : '⏳'} {expiryLabel}
              </span>
            )}
            <span style={{ color: 'var(--text-3)' }}>
              🔒 AES-256 · {secret.expiryHours}h window
            </span>
          </div>
        </div>

        {/* Right — status badge + action */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          <span className="vv-badge" style={{
            background: status.bg, color: status.color,
            border: `1px solid ${status.border}`,
          }}>
            {status.label}
          </span>

          {!isSent && !secret.burned && !isExpired && (
            <button
              className="vv-btn vv-btn-primary"
              onClick={() => onBurn(secret.id)}
              style={{ padding: '7px 14px', fontSize: 11 }}
            >
              🔓 Reveal
            </button>
          )}

          {isExpired && (
            <span style={{
              fontSize: 11, fontFamily: 'var(--mono)',
              color: 'var(--text-3)', letterSpacing: 1,
            }}>EXPIRED</span>
          )}
        </div>
      </div>
    </div>
  )
}