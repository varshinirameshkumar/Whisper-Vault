import React, { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthContext }            from '../App'
import { roomService }            from '../api/roomService'
import { publicRoomService }      from '../api/roomService'
import { fileService }            from '../api/fileService'
import { useWebSocket }           from '../hooks/useWebSocket'
import { useCrypto }              from '../hooks/useCrypto'
import ChatBubble                 from '../components/ChatBubble'

const MAX_FILE_BYTES    = 5 * 1024 * 1024
const BURN_DELAY_MS     = 60_000
const INVITE_TIMEOUT_MS = 30 * 60 * 1000

// ─── Emoji Picker ─────────────────────────────────────────────────────────────
const EMOJI_GROUPS = [
  { label:'😊', emojis:['😀','😂','🥲','😊','😍','🤩','😎','🥸','😤','😭','😱','🤔','🤫','🤐','😶','🙄','😏','😒','🙃','🤯'] },
  { label:'👍', emojis:['👍','👎','👏','🙌','🤝','✌️','🤞','🤟','🤙','👋','🫡','🫶','❤️','🔥','💯','✅','❌','⚡','🎉','🚀'] },
  { label:'🌍', emojis:['🌍','🌙','⭐','🌈','🍕','🍔','☕','🎵','🎮','📱','💻','🔐','💀','👻','🤖','🦊','🐱','🐶','🦁','🐸'] },
]
function EmojiPicker({ onSelect, onClose }) {
  const [group, setGroup] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} className="scale-in" style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:10, zIndex:200, width:280, boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
      <div style={{ display:'flex', gap:4, marginBottom:8 }}>
        {EMOJI_GROUPS.map((g,i) => (
          <button key={i} onClick={() => setGroup(i)} style={{ padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer', fontSize:16, background: group===i ? 'var(--accent-dim)' : 'transparent', outline: group===i ? '1px solid var(--accent)' : 'none' }}>{g.label}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:2 }}>
        {EMOJI_GROUPS[group].emojis.map(em => (
          <button key={em} onClick={() => onSelect(em)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:'4px', borderRadius:4 }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-3)'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>{em}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Main GroupVault ──────────────────────────────────────────────────────────
export default function GroupVault() {
  const { roomId }     = useParams()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { user }       = useContext(AuthContext)

  // Store username in a ref AND also read it from localStorage JWT as fallback
  // This ensures it's always correct even if context lags
  const myUsername = user?.username || (() => {
    try {
      const token = localStorage.getItem('wv_token')
      if (!token) return null
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub || payload.username || null
    } catch { return null }
  })()

  const inviteToken = searchParams.get('inviteToken')

  const [room, setRoom]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [messages, setMessages]   = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending]     = useState(false)
  const [burned, setBurned]       = useState(false)
  const [burnReason, setBurnReason]       = useState('')
  const [sessionDuration, setSessionDuration] = useState(null)
  const [dragOver, setDragOver]   = useState(false)
  const [burnCountdown, setBurnCountdown] = useState(null)
  const [wsEnabled, setWsEnabled] = useState(false)
  const [showBurnConfirm, setShowBurnConfirm] = useState(false)
  const [burningRoom, setBurningRoom] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)

  // Voice
  const [recording, setRecording]           = useState(false)
  const [recordSeconds, setRecordSeconds]   = useState(0)
  const [audioBlob, setAudioBlob]           = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const recordTimerRef   = useRef(null)

  const messagesEndRef = useRef(null)
  const fileInputRef   = useRef(null)
  const textareaRef    = useRef(null)
  const burnTimerRef   = useRef(null)
  const countdownRef   = useRef(null)
  const sessionStartRef = useRef(Date.now())
  const roomRef        = useRef(null)
  // Store myUsername in a ref so callbacks always have latest value
  const myUsernameRef  = useRef(myUsername)
  useEffect(() => { myUsernameRef.current = myUsername }, [myUsername])
  useEffect(() => { roomRef.current = room }, [room])

  const { encrypt, encryptFile } = useCrypto(roomId)

  // ─── Burn helpers ──────────────────────────────────────────────────────────
  const triggerBurn = useCallback((reason, duration) => {
    clearTimeout(burnTimerRef.current); clearInterval(countdownRef.current)
    setBurned(true); setBurnReason(reason)
    if (duration) setSessionDuration(duration)
  }, [])

  const startBurnCountdown = useCallback(() => {
    let secs = BURN_DELAY_MS / 1000
    setBurnCountdown(secs)
    countdownRef.current = setInterval(() => {
      secs--; setBurnCountdown(secs)
      if (secs <= 0) {
        clearInterval(countdownRef.current)
        const e = Math.round((Date.now() - sessionStartRef.current) / 1000)
        triggerBurn('All participants left', `${Math.floor(e/60)}m ${e%60}s`)
      }
    }, 1000)
  }, [triggerBurn])

  // ─── Join on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await roomService.joinRoom(roomId)
        const data = await roomService.getRoom(roomId)
        if (!data || data.status === 'BURNED') { triggerBurn('Session already purged'); return }
        setRoom(data); setWsEnabled(true)
        if (data.status === 'PENDING') {
          burnTimerRef.current = setTimeout(() => triggerBurn('Invite expired'), INVITE_TIMEOUT_MS)
          toast('Waiting for others…', { icon:'⏳', duration:5000 })
        }
      } catch { toast.error('Unable to access this vault room.'); navigate('/vault-rooms') }
      finally { setLoading(false) }
    }
    init()
    return () => { clearTimeout(burnTimerRef.current); clearInterval(countdownRef.current) }
  }, [roomId]) // eslint-disable-line

  // ─── Add own message optimistically ───────────────────────────────────────
  const addOwnMessage = useCallback((msg) => {
    // Tag with _own:true and the sender's username so it renders correctly immediately
    setMessages(prev => [...prev, {
      ...msg,
      sender:    myUsernameRef.current,
      timestamp: new Date().toISOString(),
      _own:      true,
    }])
  }, [])

  // ─── WS message handler ────────────────────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    setMessages(prev => {
      // Case 1: This is the echo of our own sent message — replace the optimistic copy
      if (msg.iv && msg.sender === myUsernameRef.current) {
        const idx = prev.findIndex(m => m._own && m.iv === msg.iv)
        if (idx !== -1) {
          const next = [...prev]; next[idx] = { ...msg }; return next
        }
      }
      // Case 2: Already have this message (by iv) — skip to prevent duplicates from history replay
      if (msg.iv && prev.some(m => m.iv === msg.iv && !m._own)) return prev
      // Case 3: New message from another user — append as-is
      return [...prev, msg]
    })
  }, [])

  const handleHistory = useCallback((h) => {
    if (!h.length) return
    setMessages(h) // History replaces everything (server is authoritative for past messages)
  }, [])

  const handleSystemEvent = useCallback((event) => {
    if (event.type === 'ROOM_BURNED') {
      clearTimeout(burnTimerRef.current); clearInterval(countdownRef.current)
      setBurnCountdown(null)
      triggerBurn('Omni-Burn complete', event.duration)
      toast.error('⚡ Session permanently purged', { duration:6000 }); return
    }
    if (event.type === 'LEAVE') {
      setTimeout(async () => {
        try {
          const data = await roomService.getRoom(roomId)
          if ((data?.acceptedUsernames?.length || 0) <= 1) {
            startBurnCountdown()
            toast('Everyone left — vault burns in 60s', { icon:'🔥', duration:8000 })
          }
        } catch {}
      }, 1000)
    }
    if (event.type === 'JOIN') { clearInterval(countdownRef.current); setBurnCountdown(null) }
    if (event.type === 'KNOCK_REQUEST') {
      if (roomRef.current?.creatorUsername === myUsernameRef.current) {
        toast((t) => (
          <div style={{ fontFamily:'var(--mono)' }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>🚪 <strong>{event.sender}</strong> wants to join</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={async () => {
                toast.dismiss(t.id)
                try { await publicRoomService.acceptKnock(roomId, event.sender); toast.success(`✅ ${event.sender} granted access`) }
                catch { toast.error('Failed to accept') }
              }} style={{ padding:'5px 14px', background:'var(--success)', border:'none', borderRadius:5, color:'#000', cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, fontWeight:700 }}>ACCEPT</button>
              <button onClick={() => toast.dismiss(t.id)} style={{ padding:'5px 10px', background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-2)', cursor:'pointer', fontFamily:'var(--mono)', fontSize:11 }}>Dismiss</button>
            </div>
          </div>
        ), { duration:60000, id:`knock-${event.sender}` })
      }
      setMessages(p => [...p, { type:'SYSTEM', encryptedPayload:`🚪 ${event.sender} requested to join`, timestamp:new Date().toISOString() }])
      return
    }
    if (event.type === 'KNOCK_ACCEPTED') {
      setMessages(p => [...p, { type:'SYSTEM', encryptedPayload:`✅ ${event.targetUser||event.sender} joined the conversation`, timestamp:new Date().toISOString() }])
      return
    }
    setMessages(p => [...p, event])
  }, [roomId, triggerBurn, startBurnCountdown])

  const { connected, connecting, sendMessage, disconnect } = useWebSocket({
    roomId, onMessage:handleMessage, onHistory:handleHistory,
    onSystemEvent:handleSystemEvent, enabled:wsEnabled && !burned,
  })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  // ─── Send text ─────────────────────────────────────────────────────────────
  const sendText = async () => {
    const text = inputText.trim()
    if (!text || !connected || sending) return
    setSending(true)
    try {
      const { encryptedPayload, iv } = await encrypt(text)
      const msg = { type:'TEXT', encryptedPayload, iv }
      if (sendMessage(msg)) { setInputText(''); addOwnMessage(msg) }
      else toast.error('Connection lost — reconnecting…')
    } catch { toast.error('Encryption failed') }
    finally { setSending(false) }
  }

  // ─── Send file — encrypt → REST upload → WS token ─────────────────────────
  const sendFile = async (file) => {
    if (file.size > MAX_FILE_BYTES) { toast.error('File exceeds 5 MB limit'); return }
    if (!connected) { toast.error('Not connected yet'); return }
    setSending(true)
    const tid = toast.loading(`Encrypting ${file.name}…`)
    try {
      // 1. Encrypt client-side → Base64 payload + IV
      const { encryptedPayload, iv, fileName, mimeType, fileSize } = await encryptFile(file)

      // 2. Convert Base64 to raw bytes for multipart upload
      const binary = atob(encryptedPayload)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const encBlob = new Blob([bytes], { type: 'application/octet-stream' })

      toast.dismiss(tid)
      const tid2 = toast.loading(`Uploading ${file.name}…`)

      // 3. Upload encrypted bytes via REST (HTTP handles large files reliably)
      const { token } = await fileService.upload(roomId, encBlob, iv, fileName, mimeType, fileSize, 'FILE')
      toast.dismiss(tid2)

      // 4. Send small token message over WebSocket (no large payload in WS frame)
      const msg = { type: 'FILE', fileToken: token, iv, fileName, mimeType, fileSize }
      sendMessage(msg)
      addOwnMessage(msg)
      toast.success(`📎 ${file.name} sent`)
    } catch (err) {
      toast.dismiss(tid)
      toast.error(err?.response?.data?.message || 'File upload failed')
    } finally { setSending(false) }
  }

  const handleFileInput = (e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value='' }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) sendFile(f) }

  // ─── Voice ─────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType:'audio/webm;codecs=opus' })
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => { setAudioBlob(new Blob(audioChunksRef.current, { type:'audio/webm' })); stream.getTracks().forEach(t=>t.stop()) }
      mr.start(100); mediaRecorderRef.current = mr
      setRecording(true); setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s+1), 1000)
    } catch { toast.error('Microphone access denied') }
  }
  const stopRecording   = () => { mediaRecorderRef.current?.stop(); clearInterval(recordTimerRef.current); setRecording(false) }
  const cancelRecording = () => { stopRecording(); setAudioBlob(null); audioChunksRef.current=[] }

  const sendVoice = async () => {
    if (!audioBlob || !connected) return
    setSending(true)
    const tid = toast.loading('Encrypting voice…')
    try {
      const file = new File([audioBlob], 'voice-message.webm', { type:'audio/webm' })

      // 1. Encrypt client-side
      const { encryptedPayload, iv, fileName, mimeType, fileSize } = await encryptFile(file)

      // 2. Convert Base64 to raw bytes
      const binary = atob(encryptedPayload)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const encBlob = new Blob([bytes], { type: 'application/octet-stream' })

      toast.dismiss(tid)
      const tid2 = toast.loading('Uploading voice…')

      // 3. Upload via REST
      const { token } = await fileService.upload(roomId, encBlob, iv, fileName, mimeType, fileSize, 'VOICE')
      toast.dismiss(tid2)

      // 4. Send small token over WebSocket
      const msg = { type: 'VOICE', fileToken: token, iv, fileName: 'voice-message.webm', mimeType: 'audio/webm', fileSize }
      sendMessage(msg)
      addOwnMessage(msg)
      setAudioBlob(null)
      toast.success('🎙 Voice sent')
    } catch (err) {
      toast.dismiss(tid)
      toast.error(err?.response?.data?.message || 'Voice upload failed')
    } finally { setSending(false) }
  }

  const fmtRec = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
  const insertEmoji = (em) => { setInputText(p => p+em); setShowEmoji(false); textareaRef.current?.focus() }

  // ─── Burn ──────────────────────────────────────────────────────────────────
  const handleBurnRoom = async () => {
    setShowBurnConfirm(false); setBurningRoom(true)
    try {
      disconnect()
      await roomService.burnRoom(roomId)
      const e = Math.round((Date.now()-sessionStartRef.current)/1000)
      triggerBurn('Burn requested by you', `${Math.floor(e/60)}m ${e%60}s`)
    } catch (err) { toast.error(err.response?.data?.message || 'Burn failed') }
    finally { setBurningRoom(false) }
  }
  const endSession = () => { disconnect(); navigate('/vault-rooms') }

  // ─── Burned screen ─────────────────────────────────────────────────────────
  if (burned) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#080808', padding:20 }}>
      <div className="fade-in" style={{ textAlign:'center', maxWidth:420 }}>
        <div style={{ fontSize:60, marginBottom:16 }}>💀</div>
        <div style={{ fontFamily:'var(--mono)', fontSize:13, letterSpacing:3, color:'var(--danger)', marginBottom:12 }}>OMNI-BURN COMPLETE</div>
        <div style={{ fontSize:15, color:'var(--text-1)', marginBottom:8 }}>Session Permanently Purged</div>
        {burnReason && <div style={{ fontSize:12, color:'var(--text-3)', fontFamily:'var(--mono)', marginBottom:4 }}>Reason: {burnReason}</div>}
        {sessionDuration && <div style={{ fontSize:12, color:'var(--text-3)', fontFamily:'var(--mono)', marginBottom:24 }}>Duration: {sessionDuration} · Content: PURGED</div>}
        <div style={{ padding:'12px 16px', background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, marginBottom:24, fontSize:12, color:'var(--text-2)', lineHeight:1.7 }}>
          All messages permanently wiped. Create a new connection to chat again.
        </div>
        <button className="vv-btn vv-btn-primary" onClick={() => navigate('/vault-rooms')} style={{ padding:'10px 28px' }}>Return to Vault Rooms</button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#080808' }}>
      <div className="vault-spinner" />
    </div>
  )

  const participants = room?.invitedUsernames || []

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg-0)', position:'relative' }}>

      {/* Drag overlay */}
      {dragOver && (
        <div style={{ position:'fixed', inset:0, background:'rgba(255,107,53,0.08)', border:'3px dashed var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, pointerEvents:'none' }}>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:40, marginBottom:8 }}>🔒</div>
            <span style={{ fontFamily:'var(--mono)', color:'var(--accent)', fontSize:14, letterSpacing:2 }}>DROP TO ENCRYPT & SEND</span>
          </div>
        </div>
      )}

      {/* Burn confirm */}
      {showBurnConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}
          onClick={e => e.target===e.currentTarget && setShowBurnConfirm(false)}>
          <div className="fade-in vv-card" style={{ maxWidth:400, width:'100%', padding:28, textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🔥</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:12, letterSpacing:3, color:'var(--danger)', marginBottom:8 }}>CONFIRM BURN</div>
            <div style={{ fontSize:14, color:'var(--text-1)', marginBottom:8, lineHeight:1.6 }}>Permanently destroys this vault for <strong>all participants</strong>.</div>
            <div style={{ fontSize:12, color:'var(--text-3)', fontFamily:'var(--mono)', marginBottom:24 }}>Irreversible. Create a new request to chat again.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setShowBurnConfirm(false)} className="vv-btn vv-btn-ghost" style={{ padding:'9px 22px', fontSize:12 }}>Cancel</button>
              <button onClick={handleBurnRoom} disabled={burningRoom}
                style={{ padding:'9px 22px', border:'none', borderRadius:6, background:'var(--danger)', color:'#fff', cursor:'pointer', fontFamily:'var(--mono)', fontSize:12, fontWeight:700, letterSpacing:2 }}>
                {burningRoom ? 'BURNING…' : '🔥 BURN NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Burn countdown */}
      {burnCountdown !== null && (
        <div style={{ background:'rgba(255,68,85,0.15)', borderBottom:'1px solid var(--danger)', padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <span>🔥</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--danger)', letterSpacing:1 }}>VAULT BURNS IN {burnCountdown}s</span>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom:'1px solid var(--border)', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: connected?'var(--success)':connecting?'#f5a623':'var(--danger)', boxShadow: connected?'0 0 6px var(--success)':'none', transition:'background 0.3s' }} />
            <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-3)', letterSpacing:2 }}>
              {connected ? 'VAULT CONNECTED' : connecting ? 'CONNECTING…' : 'RECONNECTING…'}
            </span>
          </div>
          <div style={{ fontSize:13, color:'var(--text-2)' }}>{participants.length} participants · E2E encrypted · One-time</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:4 }}>
            {participants.slice(0,5).map(p => (
              <div key={p} title={`@${p}`} style={{ width:30, height:30, borderRadius:'50%', background:'var(--accent-dim)', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:700 }}>
                {p[0].toUpperCase()}
              </div>
            ))}
          </div>
          <button onClick={() => setShowBurnConfirm(true)} disabled={burningRoom}
            style={{ padding:'7px 14px', border:'1px solid var(--danger)', background:'transparent', color:'var(--danger)', borderRadius:6, cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, letterSpacing:1, transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,68,85,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            🔥 BURN
          </button>
          <button onClick={endSession}
            style={{ padding:'7px 14px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', borderRadius:6, cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--text-2)'; e.currentTarget.style.color='var(--text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-3)' }}>
            EXIT
          </button>
        </div>
      </div>

      {/* Room ID bar */}
      <div style={{ padding:'5px 20px', background:'var(--bg-1)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-3)', letterSpacing:1 }}>ROOM · {roomId}</span>
        <span style={{ fontFamily:'var(--mono)', fontSize:10, color: connected?'var(--success)':'var(--text-3)' }}>{connected ? '● LIVE · AES-256-GCM' : '○ CONNECTING'}</span>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
        onDrop={handleDrop}>
        {messages.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--text-3)', fontFamily:'var(--mono)', fontSize:12, letterSpacing:1 }}>
            <div style={{ fontSize:36, marginBottom:14 }}>🔒</div>
            {connecting ? 'ESTABLISHING SECURE CHANNEL…' : connected ? 'VAULT IS EMPTY · SEND THE FIRST MESSAGE' : 'CONNECTING TO VAULT…'}
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble
            key={`${msg.timestamp ?? i}-${i}`}
            message={msg}
            isOwn={!!msg._own || msg.sender === myUsername}
            roomId={roomId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ borderTop:'1px solid var(--border)', padding:'12px 20px', background:'var(--bg-1)', flexShrink:0 }}>

        {/* Voice preview */}
        {audioBlob && !recording && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'8px 12px', background:'var(--bg-2)', border:'1px solid var(--accent)', borderRadius:8 }}>
            <span style={{ fontSize:18 }}>🎙</span>
            <audio controls src={URL.createObjectURL(audioBlob)} style={{ flex:1, height:28 }} />
            <button onClick={sendVoice} disabled={!connected||sending} style={{ padding:'5px 14px', background:'var(--accent)', border:'none', borderRadius:6, color:'#000', fontFamily:'var(--mono)', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:1, opacity:(!connected||sending)?0.5:1 }}>SEND</button>
            <button onClick={cancelRecording} style={{ padding:'5px 10px', background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-3)', cursor:'pointer', fontSize:13 }}>✕</button>
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'8px 12px', background:'rgba(255,68,85,0.08)', border:'1px solid var(--danger)', borderRadius:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--danger)', animation:'pulse 1s ease-in-out infinite' }} />
            <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--danger)', letterSpacing:1 }}>REC {fmtRec(recordSeconds)}</span>
            <div style={{ display:'flex', gap:2, alignItems:'center', flex:1 }}>
              {Array.from({length:18}).map((_,i) => <div key={i} style={{ width:3, borderRadius:2, background:'var(--danger)', opacity:0.6, height:`${6+Math.abs(Math.sin(i*0.7))*10}px`, animation:`pulse ${0.3+(i%4)*0.15}s ease-in-out infinite alternate` }} />)}
            </div>
            <button onClick={stopRecording} style={{ padding:'5px 14px', background:'var(--danger)', border:'none', borderRadius:6, color:'#fff', fontFamily:'var(--mono)', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:1 }}>STOP</button>
            <button onClick={cancelRecording} style={{ padding:'5px 10px', background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-3)', cursor:'pointer', fontSize:13 }}>✕</button>
          </div>
        )}

        <div style={{ display:'flex', gap:8, alignItems:'flex-end', position:'relative' }}>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}

          <button onClick={() => setShowEmoji(p => !p)} disabled={recording}
            style={{ padding:'10px 11px', border:`1px solid ${showEmoji?'var(--accent)':'var(--border)'}`, background: showEmoji?'var(--accent-dim)':'var(--bg-2)', color:'var(--text-2)', borderRadius:8, cursor:'pointer', fontSize:16, flexShrink:0, transition:'all 0.15s' }}>😊</button>

          <button onClick={() => fileInputRef.current?.click()} disabled={!connected||sending||recording}
            style={{ padding:'10px 11px', border:'1px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', borderRadius:8, cursor:(!connected||recording)?'not-allowed':'pointer', fontSize:16, flexShrink:0, opacity:(!connected||sending||recording)?0.4:1 }}>📎</button>
          <input ref={fileInputRef} type="file" style={{ display:'none' }} onChange={handleFileInput} />

          <button onClick={recording ? stopRecording : startRecording} disabled={!connected||sending||!!audioBlob}
            style={{ padding:'10px 11px', border:`1px solid ${recording?'var(--danger)':'var(--border)'}`, background: recording?'rgba(255,68,85,0.1)':'var(--bg-2)', color: recording?'var(--danger)':'var(--text-3)', borderRadius:8, cursor:(!connected||!!audioBlob)?'not-allowed':'pointer', fontSize:16, flexShrink:0, opacity:(!connected||sending||!!audioBlob)?0.4:1 }}>🎙</button>

          <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendText() }}}
            placeholder={connected ? 'Type a secret message… (AES-256-GCM)' : 'Connecting…'}
            rows={1} disabled={!connected||sending||recording}
            style={{ flex:1, resize:'none', padding:'10px 14px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-1)', fontFamily:'var(--sans)', fontSize:14, lineHeight:1.5, outline:'none', opacity:(!connected||sending||recording)?0.5:1 }} />

          <button onClick={sendText} disabled={!connected||sending||!inputText.trim()||recording}
            style={{ padding:'10px 20px', background:'var(--accent)', border:'none', borderRadius:8, cursor:(!connected||sending||!inputText.trim()||recording)?'not-allowed':'pointer', color:'#000', fontFamily:'var(--mono)', fontSize:12, fontWeight:700, letterSpacing:1, flexShrink:0, opacity:(!connected||sending||!inputText.trim()||recording)?0.4:1 }}>
            {sending ? '…' : 'SEND'}
          </button>
        </div>

        <div style={{ marginTop:6, display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text-3)', letterSpacing:1 }}>ENTER to send · SHIFT+ENTER new line · 😊 emoji · 📎 file · 🎙 voice</span>
          <span style={{ fontSize:10, fontFamily:'var(--mono)', color: connected?'var(--success)':'var(--text-3)' }}>{connected?'● LIVE':connecting?'○ CONNECTING':'○ OFFLINE'}</span>
        </div>
      </div>
    </div>
  )
}
