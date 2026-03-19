import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'

export default function SecretRevealModal({ secret, onClose }) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(true)

  // Keyboard close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(secret.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && handleClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '24px',
        animation: 'fadeIn 0.2s ease both',
      }}
    >
      <div
        className="scale-in"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--accent)',
          borderRadius: 12,
          padding: '32px',
          maxWidth: 640,
          width: '100%',
          boxShadow: '0 0 60px var(--accent-glow)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.97)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--accent)', letterSpacing: 3,
            marginBottom: 10, textTransform: 'uppercase',
          }}>
            🔥 Secret Revealed — Permanently Destroyed
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>
            {secret.subject || 'Secret Message'}
          </h2>
          <div style={{
            fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)', marginTop: 6,
          }}>
            From @{secret.senderUsername}
            {secret.burnedAt && ` · Burned ${format(new Date(secret.burnedAt), 'PPpp')}`}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 20 }} />

        {/* Content */}
        <div style={{
          background: 'var(--bg-0)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '20px 22px',
          fontFamily: 'var(--mono)',
          fontSize: 14,
          color: 'var(--text-1)',
          lineHeight: 1.9,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          minHeight: 80,
          maxHeight: 320,
          overflowY: 'auto',
          marginBottom: 20,
        }}>
          {secret.content}
        </div>

        {/* Warning */}
        <div style={{
          background: 'var(--danger-dim)',
          border: '1px solid rgba(255,68,85,0.2)',
          borderRadius: 6,
          padding: '10px 14px',
          marginBottom: 20,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
          <div style={{
            fontSize: 12, color: 'var(--danger)',
            fontFamily: 'var(--mono)', lineHeight: 1.6, letterSpacing: 0.3,
          }}>
            This message has been permanently erased from our servers.
            No copy remains. Save what you need before closing.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            className="vv-btn vv-btn-ghost"
            onClick={handleCopy}
            style={{ color: copied ? 'var(--success)' : undefined }}
          >
            {copied ? '✓ Copied' : 'Copy Text'}
          </button>
          <button
            className="vv-btn vv-btn-primary"
            onClick={handleClose}
          >
            Close & Forget
          </button>
        </div>
      </div>
    </div>
  )
}