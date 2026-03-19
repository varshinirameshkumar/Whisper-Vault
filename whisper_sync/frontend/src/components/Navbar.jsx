import React from 'react'

export default function Navbar({ title, subtitle, actions, action }) {
  const actionContent = actions || (action ? [action] : null)
  return (
    <div style={{
      padding: '32px 40px 24px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--accent)', letterSpacing: 4,
        marginBottom: 8, textTransform: 'uppercase',
      }}>
        WhisperVault
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 5 }}>{subtitle}</p>
          )}
        </div>
        {actionContent && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actionContent}</div>}
      </div>
    </div>
  )
}