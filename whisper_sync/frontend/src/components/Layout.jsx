import React, { useContext, useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../App'
import { authService } from '../api/authService'
import { useStats } from '../hooks/useStats'
import { useTabBlur } from '../hooks/useTabBlur'

const NAV_ITEMS = [
  { to: '/dashboard',     label: 'New Secret',   icon: '✦' },
  { to: '/inbox',         label: 'Inbox',         icon: '⬇' },
  { to: '/sent',          label: 'Sent',          icon: '⬆' },
  { to: '/vault-rooms',   label: 'Vault Rooms',   icon: '⚡' },
  { to: '/public-vaults', label: 'Public',        icon: '👁' },
]

function UserAvatar({ user, size = 32 }) {
  const hasAvatar = user?.avatarMode === 'FACE' && user?.avatarBase64
  if (hasAvatar) {
    return (
      <img src={`data:image/jpeg;base64,${user.avatarBase64}`} alt="avatar"
        style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'2px solid var(--accent)' }} />
    )
  }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'var(--accent-dim)', flexShrink:0,
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'var(--accent)', fontFamily:'var(--mono)', fontSize:size*0.4, fontWeight:700, border:'2px solid var(--border)' }}>
      {user?.avatarMode === 'GHOST' ? '👻' : (user?.displayName || user?.username || '?')[0].toUpperCase()}
    </div>
  )
}

export default function Layout() {
  const { user, setUser }            = useContext(AuthContext)
  const navigate                     = useNavigate()
  const location                     = useLocation()
  const { unreadCount, refresh }     = useStats()
  const isBlurred                    = useTabBlur()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const logout = () => { authService.logout(); setUser(null); navigate('/login') }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>

      {/* Blur shield */}
      {isBlurred && (
        <div className="blur-overlay">
          <div style={{ fontSize:40, marginBottom:4 }}>🔐</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:13, letterSpacing:4, color:'var(--accent)', textTransform:'uppercase' }}>Content Protected</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:2, color:'var(--text-3)', marginTop:4 }}>Tap to resume</div>
        </div>
      )}

      {/* Mobile overlay — closes sidebar when tapping outside */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Logo */}
        <div style={{ padding:'22px 18px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:700, letterSpacing:3, lineHeight:1.3 }}>
              <span style={{ color:'var(--accent)' }}>⚡</span>
              <span style={{ color:'var(--text-1)' }} className="sidebar-label"> WHISPER</span><br />
              <span style={{ color:'var(--text-1)', paddingLeft:20 }} className="sidebar-label">VAULT</span>
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', letterSpacing:3, marginTop:6 }} className="sidebar-logo-text sidebar-label">
              Whisper-Social Edition
            </div>
          </div>
          {/* Close button — mobile only */}
          <button onClick={() => setSidebarOpen(false)} className="mobile-only"
            style={{ display:'none', background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:20, padding:4 }}>
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
              borderRadius:6, marginBottom:2, textDecoration:'none',
              fontFamily:'var(--mono)', fontSize:12, letterSpacing:1, fontWeight:700,
              textTransform:'uppercase', transition:'all var(--transition)',
              background:   isActive ? 'var(--accent-dim)' : 'transparent',
              color:        isActive ? 'var(--accent)'     : 'var(--text-3)',
              borderLeft:   isActive ? '2px solid var(--accent)' : '2px solid transparent',
              minHeight: 44,
            })}>
              <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
              <span className="sidebar-label" style={{ flex:1 }}>{label}</span>
              {to === '/inbox' && unreadCount > 0 && (
                <span className="sidebar-label" style={{ background:'var(--accent)', color:'#000', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Security indicators */}
        <div className="sidebar-security" style={{ margin:'0 8px 10px', padding:12, background:'var(--bg-0)', borderRadius:6, border:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', letterSpacing:2, marginBottom:8, textTransform:'uppercase' }}>Security</div>
          {['AES-256-GCM','JWT Auth','Tab Shield','E2E WS'].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text-2)', fontFamily:'var(--mono)', marginBottom:4 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--success)', display:'inline-block', boxShadow:'0 0 6px var(--success)', flexShrink:0 }} />
              {f}
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <UserAvatar user={user} size={34} />
            <div className="sidebar-user-info" style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {user?.displayName || user?.username}
              </div>
              <div style={{ fontSize:10, color:'var(--text-3)', fontFamily:'var(--mono)', marginTop:1 }}>@{user?.username}</div>
              {user?.bio && <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.bio}</div>}
            </div>
          </div>
          <NavLink to="/profile" className="sidebar-label" style={({ isActive }) => ({
            display:'block', textAlign:'center', padding:'6px', marginBottom:6,
            borderRadius:6, border:'1px solid var(--border)', textDecoration:'none',
            fontFamily:'var(--mono)', fontSize:10, letterSpacing:2,
            color: isActive ? 'var(--accent)' : 'var(--text-3)',
            background: isActive ? 'var(--accent-dim)' : 'transparent',
            transition:'all var(--transition)',
          })}>
            👤 VAULT IDENTITY
          </NavLink>
          <button onClick={logout} className="vv-btn vv-btn-ghost sidebar-label" style={{ width:'100%', fontSize:10, padding:'7px', letterSpacing:2 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--danger)'; e.currentTarget.style.color='var(--danger)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-2)' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        {/* Mobile top bar */}
        <div style={{ display:'none', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-1)', position:'sticky', top:0, zIndex:50 }} className="mobile-only" id="mobile-topbar">
          <button onClick={() => setSidebarOpen(true)}
            style={{ background:'none', border:'none', color:'var(--text-2)', cursor:'pointer', fontSize:22, padding:4, lineHeight:1 }}>
            ☰
          </button>
          <div style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:700, color:'var(--accent)', letterSpacing:2 }}>⚡ WHISPER</div>
          <NavLink to="/profile" style={{ textDecoration:'none' }}>
            <UserAvatar user={user} size={30} />
          </NavLink>
        </div>

        <Outlet context={{ refreshStats: refresh }} />
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mobile-nav">
        {NAV_ITEMS.map(({ to, label, icon }) => {
          const isActive = location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} className={`mobile-nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{icon}</span>
              <span className="nav-label" style={{ fontSize:8 }}>{label}</span>
              {to === '/inbox' && unreadCount > 0 && (
                <span style={{ position:'absolute', top:4, right:'calc(50% - 14px)', background:'var(--accent)', color:'#000', borderRadius:8, padding:'0 4px', fontSize:9, fontWeight:700 }}>
                  {unreadCount}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Mobile topbar CSS injection */}
      <style>{`
        @media (max-width: 768px) {
          #mobile-topbar { display: flex !important; }
          .mobile-only { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>
    </div>
  )
}
