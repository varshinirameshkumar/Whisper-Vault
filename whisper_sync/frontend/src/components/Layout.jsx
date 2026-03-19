import React, { useContext } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { AuthContext } from '../App'
import { authService } from '../api/authService'
import { useStats } from '../hooks/useStats'
import { useTabBlur } from '../hooks/useTabBlur'

const NAV_ITEMS = [
  { to: '/dashboard',     label: 'New Secret',    icon: '✦' },
  { to: '/inbox',         label: 'Inbox',          icon: '⬇' },
  { to: '/sent',          label: 'Sent',           icon: '⬆' },
  { to: '/vault-rooms',   label: 'Vault Rooms',    icon: '⚡' },
  { to: '/public-vaults', label: 'Public Vaults',  icon: '👁' },
]

function UserAvatar({ user, size = 32 }) {
  const hasAvatar = user?.avatarMode === 'FACE' && user?.avatarBase64
  if (hasAvatar) {
    return (
      <img
        src={`data:image/jpeg;base64,${user.avatarBase64}`}
        alt="avatar"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--accent)' }}
      />
    )
  }
  // Ghost / initials fallback
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--accent-dim)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--accent)', fontFamily: 'var(--mono)',
      fontSize: size * 0.4, fontWeight: 700,
      border: '2px solid var(--border)',
    }}>
      {user?.avatarMode === 'GHOST'
        ? '👻'
        : (user?.displayName || user?.username || '?')[0].toUpperCase()}
    </div>
  )
}

export default function Layout() {
  const { user, setUser } = useContext(AuthContext)
  const navigate          = useNavigate()
  const { unreadCount, refresh } = useStats()
  const isBlurred         = useTabBlur()

  const logout = () => { authService.logout(); setUser(null); navigate('/login') }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>

      {isBlurred && (
        <div className="blur-overlay" onClick={() => {}}>
          <div style={{ fontSize:40, marginBottom:4 }}>🔐</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:13, letterSpacing:4, color:'var(--accent)', textTransform:'uppercase' }}>Content Protected</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:2, color:'var(--text-3)', marginTop:4 }}>Click to resume</div>
        </div>
      )}

      {/* Sidebar */}
      <aside style={{ width:230, background:'var(--bg-1)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>

        {/* Logo */}
        <div style={{ padding:'26px 22px 22px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:15, fontWeight:700, letterSpacing:3, lineHeight:1.3 }}>
            <span style={{ color:'var(--accent)' }}>⚡</span>
            <span style={{ color:'var(--text-1)' }}> WHISPER</span><br />
            <span style={{ color:'var(--text-1)', paddingLeft:20 }}>VAULT</span>
          </div>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', letterSpacing:3, marginTop:6, textTransform:'uppercase' }}>Whisper-Social Edition</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'14px 10px' }}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:6, marginBottom:2,
              textDecoration:'none', fontFamily:'var(--mono)', fontSize:12, letterSpacing:1, fontWeight:700,
              textTransform:'uppercase', transition:'all var(--transition)',
              background:   isActive ? 'var(--accent-dim)' : 'transparent',
              color:        isActive ? 'var(--accent)'     : 'var(--text-3)',
              borderLeft:   isActive ? '2px solid var(--accent)' : '2px solid transparent',
            })}>
              <span style={{ fontSize:14 }}>{icon}</span>
              <span style={{ flex:1 }}>{label}</span>
              {to === '/inbox' && unreadCount > 0 && (
                <span style={{ background:'var(--accent)', color:'#000', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Security indicators */}
        <div style={{ margin:'0 10px 12px', padding:12, background:'var(--bg-0)', borderRadius:6, border:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', letterSpacing:2, marginBottom:8, textTransform:'uppercase' }}>Security Status</div>
          {['AES-256-GCM', 'JWT Auth', 'Tab Shield', 'E2E WebSocket'].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-2)', fontFamily:'var(--mono)', marginBottom:4 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', display:'inline-block', boxShadow:'0 0 6px var(--success)' }} />
              {f}
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{ padding:'14px 16px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <UserAvatar user={user} size={36} />
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {user?.displayName || user?.username}
              </div>
              <div style={{ fontSize:10, color:'var(--text-3)', fontFamily:'var(--mono)', marginTop:1 }}>@{user?.username}</div>
              {user?.bio && <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.bio}</div>}
            </div>
          </div>
          {/* Profile link */}
          <NavLink to="/profile" style={({ isActive }) => ({
            display:'block', textAlign:'center', padding:'6px', marginBottom:6,
            borderRadius:6, border:'1px solid var(--border)', textDecoration:'none',
            fontFamily:'var(--mono)', fontSize:10, letterSpacing:2,
            color: isActive ? 'var(--accent)' : 'var(--text-3)',
            background: isActive ? 'var(--accent-dim)' : 'transparent',
            transition:'all var(--transition)',
          })}>
            👤 VAULT IDENTITY
          </NavLink>
          <button onClick={logout} className="vv-btn vv-btn-ghost" style={{ width:'100%', fontSize:10, padding:'7px', letterSpacing:2 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--danger)'; e.currentTarget.style.color='var(--danger)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-2)' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflow:'auto', background:'var(--bg-0)' }}>
        <Outlet context={{ refreshStats: refresh }} />
      </main>
    </div>
  )
}
