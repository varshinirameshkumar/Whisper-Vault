import React from 'react'

export default function Navbar({ title, subtitle, actions, action }) {
  const actionContent = actions || (action ? [action] : null)
  return (
    <div className="page-navbar" style={{ padding:'24px 40px 20px', borderBottom:'1px solid var(--border)' }}>
      <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--accent)', letterSpacing:4, marginBottom:8, textTransform:'uppercase' }}>
        WhisperVault
      </div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize:'clamp(16px, 4vw, 22px)', fontWeight:600, color:'var(--text-1)', lineHeight:1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ color:'var(--text-2)', fontSize:'clamp(12px, 3vw, 13px)', marginTop:5, lineHeight:1.5 }}>{subtitle}</p>
          )}
        </div>
        {actionContent && (
          <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>{actionContent}</div>
        )}
      </div>
    </div>
  )
}
