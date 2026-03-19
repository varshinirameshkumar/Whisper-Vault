import React, { useState, useEffect, useContext, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthContext } from '../App'
import { roomService, publicRoomService } from '../api/roomService'
import { useWebSocket } from '../hooks/useWebSocket'
import { useCrypto } from '../hooks/useCrypto'
import Navbar from '../components/Navbar'

const mono = { fontFamily: 'var(--mono)' }
const fmtTime = (ts) => { try { return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) } catch { return '' } }

// ─── Live Spectator Feed (read-only stream for a specific room) ───────────────
function SpectatorFeed({ room, currentUser, onKnock, onClose }) {
  const [messages, setMessages]     = useState([])
  const [knockPending, setKnockPending] = useState(false)
  const [knocked, setKnocked]       = useState(false)
  const [promoted, setPromoted]     = useState(false)
  const messagesEndRef              = useRef(null)
  const { decrypt }                 = useCrypto(room.id)

  const handleMessage = useCallback((msg) => {
    // Spectators see messages arrive but content is encrypted — show "encrypted" state
    setMessages(p => [...p, { ...msg, _spectating: true }])
  }, [])

  const handleSystemEvent = useCallback((event) => {
    if (event.type === 'KNOCK_ACCEPTED' && event.targetUser === currentUser) {
      setPromoted(true)
      toast.success('🎉 You have been granted access! Joining as active chatter…')
      setTimeout(() => { window.location.href = `/vault-rooms/${room.id}` }, 1500)
    }
    if (event.type === 'ROOM_BURNED') {
      toast.error('Room has been terminated')
      onClose()
    }
    setMessages(p => [...p, event])
  }, [currentUser, room.id, onClose])

  const { connected } = useWebSocket({
    roomId: room.id,
    onMessage: handleMessage,
    onSystemEvent: handleSystemEvent,
    enabled: true,
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  const handleKnock = async () => {
    setKnockPending(true)
    try {
      await publicRoomService.knock(room.id)
      setKnocked(true)
      toast.success('Knock sent! Waiting for the owner to accept…')
    } catch { toast.error('Could not send knock request') }
    finally { setKnockPending(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, padding:16 }}>
      <div className="fade-in" style={{ width:'100%', maxWidth:560, height:'80vh', display:'flex', flexDirection:'column', background:'var(--bg-0)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-1)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
              <span style={{ padding:'2px 8px', borderRadius:10, background:'rgba(61,220,132,0.1)', color:'var(--success)', ...mono, fontSize:10, letterSpacing:1 }}>👁 SPECTATING</span>
              <div style={{ width:6, height:6, borderRadius:'50%', background: connected ? 'var(--success)' : '#f5a623', boxShadow: connected ? '0 0 4px var(--success)' : 'none' }} />
              <span style={{ ...mono, fontSize:10, color:'var(--text-3)' }}>{connected ? 'LIVE' : 'CONNECTING'}</span>
            </div>
            <div style={{ ...mono, fontSize:10, color:'var(--text-3)', letterSpacing:1 }}>by @{room.creatorUsername}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {!knocked && !promoted && (
              <button onClick={handleKnock} disabled={knockPending}
                style={{ padding:'6px 14px', border:'1px solid var(--accent)', background:'var(--accent-dim)', color:'var(--accent)', borderRadius:6, cursor:'pointer', ...mono, fontSize:11, letterSpacing:1, fontWeight:700 }}>
                {knockPending ? '…' : '🚪 Request to Join'}
              </button>
            )}
            {knocked && !promoted && (
              <span style={{ padding:'6px 14px', border:'1px solid var(--border)', borderRadius:6, ...mono, fontSize:11, color:'var(--text-3)' }}>
                ⏳ Knock pending…
              </span>
            )}
            <button onClick={onClose} style={{ padding:'6px 12px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', borderRadius:6, cursor:'pointer', fontSize:14 }}>✕</button>
          </div>
        </div>

        {/* Messages — read-only spectator view */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-3)', ...mono, fontSize:11, letterSpacing:1 }}>
              <div style={{ fontSize:28, marginBottom:10 }}>👁</div>
              WAITING FOR MESSAGES…<br/>
              <span style={{ fontSize:10, marginTop:6, display:'block' }}>Content is E2E encrypted — visible only to active participants</span>
            </div>
          )}
          {messages.map((msg, i) => {
            const isSystem = ['JOIN','LEAVE','SYSTEM','KNOCK_REQUEST','KNOCK_ACCEPTED','ROOM_BURNED'].includes(msg.type)
            return isSystem ? (
              <div key={i} style={{ textAlign:'center', margin:'6px 0' }}>
                <span style={{ ...mono, fontSize:11, color:'var(--text-3)' }}>
                  {msg.type === 'JOIN' ? '→ ' : msg.type === 'LEAVE' ? '← ' : '⚙ '}{msg.encryptedPayload || msg.message}
                </span>
              </div>
            ) : (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ ...mono, fontSize:10, color:'var(--text-3)', marginBottom:3 }}>@{msg.sender} · {fmtTime(msg.timestamp)}</div>
                <div style={{ padding:'8px 12px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'2px 10px 10px 10px', fontSize:13, color:'var(--text-3)', ...mono, letterSpacing:1 }}>
                  {msg.type === 'FILE'  ? `📎 [encrypted file — ${msg.fileName || 'file'}]` :
                   msg.type === 'VOICE' ? `🎙 [encrypted voice message]` :
                   `🔒 [encrypted message]`}
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding:'8px 16px', borderTop:'1px solid var(--border)', background:'var(--bg-1)' }}>
          <div style={{ ...mono, fontSize:10, color:'var(--text-3)', letterSpacing:1, textAlign:'center' }}>
            READ-ONLY MODE · Content is E2E encrypted and not visible to spectators · Knock to request full access
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main PublicVaults Page ───────────────────────────────────────────────────
export default function PublicVaults() {
  const { user }                    = useContext(AuthContext)
  const navigate                    = useNavigate()
  const [rooms, setRooms]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [spectating, setSpectating] = useState(null) // room object

  const load = async () => {
    try {
      const data = await publicRoomService.listPublicRooms()
      setRooms(data || [])
    } catch { toast.error('Failed to load public vaults') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const createPublicRoom = async () => {
    setCreating(true)
    try {
      const data = await publicRoomService.createPublicRoom()
      toast.success('Public vault created!')
      navigate(`/vault-rooms/${data.roomId}`)
    } catch { toast.error('Failed to create public vault') }
    finally { setCreating(false) }
  }

  const enterSpectatorMode = async (room) => {
    try {
      await publicRoomService.spectate(room.id)
      setSpectating(room)
    } catch { toast.error('Could not connect to room') }
  }

  const isOwner   = (room) => room.creatorUsername === user?.username
  const isMember  = (room) => room.acceptedUsernames?.includes(user?.username)

  return (
    <div>
      {spectating && (
        <SpectatorFeed
          room={spectating}
          currentUser={user?.username}
          onClose={() => { setSpectating(null); load() }}
        />
      )}

      <Navbar
        title="Public Vaults"
        subtitle="Live public conversations with spectator access and request-to-join"
        action={
          <button onClick={createPublicRoom} disabled={creating} className="vv-btn vv-btn-primary" style={{ padding:'8px 18px', fontSize:12, letterSpacing:2 }}>
            {creating ? '…' : '+ PUBLIC VAULT'}
          </button>
        }
      />

      <div style={{ padding:'24px 40px', maxWidth:760 }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><div className="vault-spinner" /></div>
        ) : rooms.length === 0 ? (
          <div className="vv-card fade-in" style={{ padding:'60px 40px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>👁</div>
            <div style={{ ...mono, fontSize:12, letterSpacing:2, color:'var(--text-3)', marginBottom:8 }}>NO PUBLIC VAULTS ACTIVE</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:24 }}>Create a public vault to broadcast a live encrypted conversation. Anyone can watch; approved users can chat.</div>
            <button onClick={createPublicRoom} disabled={creating} className="vv-btn vv-btn-primary" style={{ padding:'10px 24px' }}>
              {creating ? 'Creating…' : 'Create Public Vault'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {rooms.map(room => (
              <div key={room.id} className="vv-card fade-in" style={{ padding:'18px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ padding:'2px 8px', borderRadius:10, background:'rgba(61,220,132,0.1)', color:'var(--success)', ...mono, fontSize:10, letterSpacing:1 }}>● LIVE</span>
                    <span style={{ padding:'2px 8px', borderRadius:10, background:'rgba(255,107,53,0.1)', color:'var(--accent)', ...mono, fontSize:10, letterSpacing:1 }}>PUBLIC</span>
                    {isOwner(room) && <span style={{ padding:'2px 8px', borderRadius:10, background:'var(--accent-dim)', color:'var(--accent)', ...mono, fontSize:10, letterSpacing:1 }}>OWNER</span>}
                    {isMember(room) && !isOwner(room) && <span style={{ padding:'2px 8px', borderRadius:10, background:'var(--success-dim)', color:'var(--success)', ...mono, fontSize:10, letterSpacing:1 }}>MEMBER</span>}
                  </div>
                  <div style={{ ...mono, fontSize:11, color:'var(--text-3)', letterSpacing:1, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{room.id}</div>
                  <div style={{ fontSize:12, color:'var(--text-2)', display:'flex', gap:14, flexWrap:'wrap' }}>
                    <span>👤 by @{room.creatorUsername}</span>
                    <span>💬 {room.acceptedUsernames?.length || 0} chatting</span>
                    <span>👁 {room.spectators?.length || 0} watching</span>
                    {(room.knockRequests && Object.keys(room.knockRequests).length > 0) && (
                      <span style={{ color:'var(--accent)' }}>🚪 {Object.keys(room.knockRequests).length} knock(s)</span>
                    )}
                  </div>
                </div>

                <div style={{ flexShrink:0, display:'flex', gap:8 }}>
                  {isOwner(room) || isMember(room) ? (
                    <button onClick={() => navigate(`/vault-rooms/${room.id}`)} className="vv-btn vv-btn-primary" style={{ padding:'7px 16px', fontSize:11, letterSpacing:2 }}>
                      ENTER
                    </button>
                  ) : (
                    <button onClick={() => enterSpectatorMode(room)} style={{ padding:'7px 16px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-2)', borderRadius:6, cursor:'pointer', ...mono, fontSize:11, letterSpacing:1, transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                      👁 WATCH
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop:24, padding:'14px 16px', background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8 }}>
          <div style={{ ...mono, fontSize:11, color:'var(--text-3)', letterSpacing:1, marginBottom:6 }}>SPECTATOR PROTOCOL</div>
          <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.7 }}>
            Spectators receive a <strong style={{ color:'var(--text-1)' }}>read-only encrypted stream</strong> — messages appear but content remains locked. To participate, send a <strong style={{ color:'var(--text-1)' }}>Knock Request</strong>. The room owner receives a toast notification and can grant or deny access in real time. When owners exit, all spectators are disconnected and the volatile memory buffer is flushed.
          </div>
        </div>
      </div>
    </div>
  )
}
