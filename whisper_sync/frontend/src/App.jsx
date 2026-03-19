import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login        from './pages/Login'
import Register     from './pages/Register'
import Dashboard    from './pages/Dashboard'
import Inbox        from './pages/Inbox'
import Sent         from './pages/Sent'
import VaultRooms   from './pages/VaultRooms'
import GroupVault   from './pages/GroupVault'
import PublicVaults from './pages/PublicVaults'
import Profile      from './pages/Profile'
import Layout       from './components/Layout'
import { authService } from './api/authService'
import './theme/global.css'

export const AuthContext = React.createContext(null)

function AppRoutes() {
  const { user } = React.useContext(AuthContext)
  return (
    <Routes>
      <Route path="/login"    element={!user ? <Login />    : <Navigate to="/dashboard" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" replace />} />
      <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="inbox"        element={<Inbox />} />
        <Route path="sent"         element={<Sent />} />
        <Route path="vault-rooms"  element={<VaultRooms />} />
        <Route path="public-vaults" element={<PublicVaults />} />
        <Route path="profile"      element={<Profile />} />
      </Route>
      <Route path="/vault-rooms/:roomId" element={user ? <GroupVault /> : <Navigate to="/login" replace />} />
      <Route path="/vault" element={user ? <VaultInviteLanding /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function VaultInviteLanding() {
  const token = new URLSearchParams(window.location.search).get('inviteToken')
  React.useEffect(() => {
    import('./api/roomService').then(({ roomService }) => {
      roomService.listMyRooms().then(rooms => {
        const room = rooms?.find(r => r.inviteTokens && Object.values(r.inviteTokens).includes(token))
        window.location.href = room ? `/vault-rooms/${room.id}?inviteToken=${token}` : '/vault-rooms'
      }).catch(() => { window.location.href = '/vault-rooms' })
    })
  }, [token])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#080808' }}>
      <div style={{ textAlign:'center' }}>
        <div className="vault-spinner" style={{ margin:'0 auto 16px' }} />
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:12, color:'#505050', letterSpacing:2 }}>VERIFYING INVITE TOKEN…</div>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('wv_token')
    if (token) {
      authService.getMe()
        .then(u => setUser(u))
        .catch(() => localStorage.removeItem('wv_token'))
        .finally(() => setLoading(false))
    } else { setLoading(false) }
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#080808' }}>
      <div className="vault-spinner" />
    </div>
  )

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter future={{ v7_startTransition:true, v7_relativeSplatPath:true }}>
        <AppRoutes />
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style:{ background:'#1a1a1a', color:'#e0e0e0', border:'1px solid #333', fontFamily:"'Space Mono',monospace", fontSize:'13px' },
        success:{ iconTheme:{ primary:'#ff6b35', secondary:'#1a1a1a' } },
        error:{   iconTheme:{ primary:'#ff4444', secondary:'#1a1a1a' } },
      }} />
    </AuthContext.Provider>
  )
}
