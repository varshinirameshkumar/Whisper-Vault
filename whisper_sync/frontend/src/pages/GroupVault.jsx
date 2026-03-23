import React, { useState, useEffect, useRef, useContext, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthContext }            from '../App'
import { roomService }            from '../api/roomService'
import { publicRoomService }      from '../api/roomService'
import { fileService }            from '../api/fileService'
import { secretService }          from '../api/secretService'
import { useWebSocket }           from '../hooks/useWebSocket'
import { useCrypto }              from '../hooks/useCrypto'
import ChatBubble                 from '../components/ChatBubble'

const MAX_FILE_BYTES    = 5 * 1024 * 1024
const BURN_DELAY_MS     = 60_000
const INVITE_TIMEOUT_MS = 30 * 60 * 1000

// ─── Emoji Picker ──────────────────────────────────────────────────────────────
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
    <div ref={ref} className="scale-in" style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:10, padding:10, zIndex:200, width:Math.min(280, window.innerWidth - 32), boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
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

// ─── Camera Modal (Photo + Video) ─────────────────────────────────────────────
function CameraModal({ onCapture, onClose, mode = 'photo' }) {
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const streamRef     = useRef(null)
  const recorderRef   = useRef(null)
  const chunksRef     = useRef([])
  const [camMode, setCamMode]     = useState(mode)  // 'photo' | 'video'
  const [recording, setRecording] = useState(false)
  const [recSecs, setRecSecs]     = useState(0)
  const [preview, setPreview]     = useState(null)  // { url, type }
  const recTimerRef = useRef(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, []) // eslint-disable-line

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user' }, audio: camMode === 'video' })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch { toast.error('Camera access denied'); onClose() }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(recTimerRef.current)
  }

  const capturePhoto = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (blob) setPreview({ blob, url: URL.createObjectURL(blob), type:'image/jpeg', name:'photo.jpg' })
    }, 'image/jpeg', 0.92)
  }

  const startVideo = () => {
    try {
      const stream = streamRef.current
      if (!stream) return
      // Re-request with audio for video recording
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(s => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = s
        if (videoRef.current) videoRef.current.srcObject = s
        chunksRef.current = []
        const mr = new MediaRecorder(s, { mimeType: 'video/webm;codecs=vp8,opus' })
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type:'video/webm' })
          setPreview({ blob, url: URL.createObjectURL(blob), type:'video/webm', name:'video.webm' })
          setRecording(false)
        }
        mr.start(100)
        recorderRef.current = mr
        setRecording(true)
        setRecSecs(0)
        recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000)
      })
    } catch { toast.error('Could not start video recording') }
  }

  const stopVideo = () => {
    recorderRef.current?.stop()
    clearInterval(recTimerRef.current)
  }

  const sendCapture = () => {
    if (preview) { onCapture(preview.blob, preview.name, preview.type); onClose() }
  }

  const retake = () => {
    setPreview(null)
    setRecording(false)
    setRecSecs(0)
    startCamera()
  }

  const fmtSec = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:16 }}>
      <div className="fade-in" style={{ background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:12, padding:20, width:'100%', maxWidth:400 }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ display:'flex', gap:8 }}>
            {['photo','video'].map(m => (
              <button key={m} onClick={() => { if (!recording && !preview) { setCamMode(m) } }}
                style={{ padding:'5px 14px', borderRadius:6, border:`1px solid ${camMode===m?'var(--accent)':'var(--border)'}`, background: camMode===m?'var(--accent-dim)':'transparent', color: camMode===m?'var(--accent)':'var(--text-3)', fontFamily:'var(--mono)', fontSize:11, cursor:'pointer', letterSpacing:1 }}>
                {m === 'photo' ? '📷 Photo' : '🎬 Video'}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>

        {/* Camera preview */}
        <div style={{ position:'relative', borderRadius:8, overflow:'hidden', background:'#000', marginBottom:14, aspectRatio:'4/3' }}>
          {!preview ? (
            <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }} />
          ) : preview.type.startsWith('video') ? (
            <video src={preview.url} controls style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          ) : (
            <img src={preview.url} alt="capture" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          )}

          {/* Recording indicator */}
          {recording && (
            <div style={{ position:'absolute', top:10, left:10, display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.7)', padding:'4px 10px', borderRadius:20 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--danger)', animation:'pulse 1s infinite' }} />
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'#fff' }}>REC {fmtSec(recSecs)}</span>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display:'none' }} />

        {/* Controls */}
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          {!preview ? (
            <>
              <button onClick={onClose} className="vv-btn vv-btn-ghost" style={{ padding:'8px 18px', fontSize:11 }}>Cancel</button>
              {camMode === 'photo' ? (
                <button onClick={capturePhoto} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:8, color:'#000', fontFamily:'var(--mono)', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:1 }}>
                  📷 CAPTURE
                </button>
              ) : (
                <button onClick={recording ? stopVideo : startVideo}
                  style={{ padding:'10px 24px', background: recording ? 'var(--danger)' : 'var(--accent)', border:'none', borderRadius:8, color: recording ? '#fff' : '#000', fontFamily:'var(--mono)', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:1 }}>
                  {recording ? '⏹ STOP' : '⬤ RECORD'}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={retake} className="vv-btn vv-btn-ghost" style={{ padding:'8px 18px', fontSize:11 }}>Retake</button>
              <button onClick={sendCapture} style={{ padding:'10px 24px', background:'var(--accent)', border:'none', borderRadius:8, color:'#000', fontFamily:'var(--mono)', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:1 }}>
                ✓ SEND
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Participant Modal ─────────────────────────────────────────────────────
function AddParticipantModal({ roomId, existingParticipants, currentUsername, onClose, onAdded }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding]   = useState(null)
  const debounceRef = useRef(null)

  const search = useCallback((q) => {
    if (q.length < 2) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const users = await secretService.searchUsers(q)
        setResults(users.filter(u => u.username !== currentUsername && !existingParticipants.includes(u.username)))
      } catch { setResults([]) } finally { setLoading(false) }
    }, 280)
  }, [existingParticipants, currentUsername])

  const handleAdd = async (user) => {
    setAdding(user.username)
    try {
      await roomService.addParticipant(roomId, user.username)
      toast.success(`@${user.username} added to the vault`)
      onAdded(user.username)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add participant')
    } finally { setAdding(null) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in vv-card" style={{ width:'100%', maxWidth:400, padding:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:3, color:'var(--accent)', marginBottom:3 }}>VAULT ROSTER</div>
            <div style={{ fontSize:15, fontWeight:600, color:'var(--text-1)' }}>Add Participant</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>

        <div style={{ position:'relative', marginBottom:16 }}>
          <input className="vv-input" value={query} onChange={e => { setQuery(e.target.value); search(e.target.value) }}
            placeholder="Search by username…" autoFocus />
          {loading && (
            <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
              <div style={{ width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'vault-spin 0.6s linear infinite' }} />
            </div>
          )}
        </div>

        {/* Current participants */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--text-3)', letterSpacing:2, marginBottom:8 }}>CURRENT PARTICIPANTS</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {existingParticipants.map(p => (
              <span key={p} style={{ padding:'3px 10px', borderRadius:10, background:'var(--success-dim)', color:'var(--success)', fontFamily:'var(--mono)', fontSize:11 }}>@{p}</span>
            ))}
          </div>
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            {results.map(u => (
              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', fontFamily:'var(--mono)', fontSize:13, fontWeight:700 }}>
                  {(u.displayName || u.username)[0].toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'var(--text-1)', fontWeight:500 }}>{u.displayName || u.username}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)' }}>@{u.username}</div>
                </div>
                <button onClick={() => handleAdd(u)} disabled={adding === u.username}
                  style={{ padding:'5px 14px', background:'var(--accent)', border:'none', borderRadius:6, color:'#000', fontFamily:'var(--mono)', fontSize:11, fontWeight:700, cursor:'pointer', opacity: adding === u.username ? 0.5 : 1 }}>
                  {adding === u.username ? '…' : '+ ADD'}
                </button>
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !loading && (
          <div style={{ textAlign:'center', padding:'20px', color:'var(--text-3)', fontFamily:'var(--mono)', fontSize:12 }}>NO USERS FOUND</div>
        )}
      </div>
    </div>
  )
}

// ─── Main GroupVault ───────────────────────────────────────────────────────────
export default function GroupVault() {
  const { roomId }               = useParams()
  const [searchParams]           = useSearchParams()
  const navigate                 = useNavigate()
  const { user }                 = useContext(AuthContext)
  const inviteToken              = searchParams.get('inviteToken')

  const [room, setRoom]          = useState(null)
  const [loading, setLoading]    = useState(true)
  const [messages, setMessages]  = useState([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending]    = useState(false)
  const [burned, setBurned]      = useState(false)
  const [burnReason, setBurnReason]     = useState('')
  const [sessionDuration, setSessionDuration] = useState(null)
  const [dragOver, setDragOver]  = useState(false)
  const [burnCountdown, setBurnCountdown] = useState(null)
  const [wsEnabled, setWsEnabled] = useState(false)
  const [showBurnConfirm, setShowBurnConfirm] = useState(false)
  const [burningRoom, setBurningRoom] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraMode, setCameraMode] = useState('photo')
  const [showAddParticipant, setShowAddParticipant] = useState(false)

  // Voice
  const [recording, setRecording]         = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [audioBlob, setAudioBlob]         = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const recordTimerRef   = useRef(null)

  const messagesEndRef  = useRef(null)
  const fileInputRef    = useRef(null)
  const textareaRef     = useRef(null)
  const burnTimerRef    = useRef(null)
  const countdownRef    = useRef(null)
  const sessionStartRef = useRef(Date.now())
  const roomRef         = useRef(null)

  const { encrypt, encryptFile } = useCrypto(roomId)
  useEffect(() => { roomRef.current = room }, [room])

  // ─── Burn helpers ──────────────────────────────────────────────────────────
  const triggerBurn = useCallback((reason, duration) => {
    clearTimeout(burnTimerRef.current); clearInterval(countdownRef.current)
    setBurned(true); setBurnReason(reason); if (duration) setSessionDuration(duration)
  }, [])

  const startBurnCountdown = useCallback(() => {
    let secs = BURN_DELAY_MS / 1000; setBurnCountdown(secs)
    countdownRef.current = setInterval(() => {
      secs -= 1; setBurnCountdown(secs)
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
          toast('Waiting for others to join…', { icon:'⏳', duration:5000 })
        }
      } catch { toast.error('Unable to access this vault room.'); navigate('/vault-rooms') }
      finally { setLoading(false) }
    }
    init()
    return () => { clearTimeout(burnTimerRef.current); clearInterval(countdownRef.current) }
  }, [roomId]) // eslint-disable-line

  // ─── Optimistic message adder ──────────────────────────────────────────────
  const addOwnMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { ...msg, sender: user?.username, timestamp: new Date().toISOString(), _own: true }])
  }, [user])

  // ─── WS handlers ──────────────────────────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    setMessages(prev => {
      if (msg.iv) {
        const idx = prev.findIndex(m => m._own && m.type === msg.type && m.iv === msg.iv && m.sender === msg.sender)
        if (idx !== -1) { const next = [...prev]; next[idx] = { ...msg }; return next }
      }
      return [...prev, msg]
    })
  }, [])

  const handleHistory = useCallback((h) => {
    if (h.length) { setMessages(h); toast('History loaded', { icon:'📜', duration:2000 }) }
  }, [])

  const handleSystemEvent = useCallback((event) => {
    if (event.type === 'ROOM_BURNED') {
      clearTimeout(burnTimerRef.current); clearInterval(countdownRef.current); setBurnCountdown(null)
      triggerBurn('Omni-Burn complete', event.duration)
      toast.error('⚡ Session permanently purged', { duration:6000 }); return
    }
    if (event.type === 'LEAVE') {
      setTimeout(async () => {
        try {
          const data = await roomService.getRoom(roomId)
          if ((data?.acceptedUsernames?.length || 0) <= 1) {
            startBurnCountdown(); toast('Everyone left — vault burns in 60s', { icon:'🔥', duration:8000 })
          }
        } catch {}
      }, 1000)
    }
    if (event.type === 'JOIN') { setBurnCountdown(null); clearInterval(countdownRef.current) }
    if (event.type === 'KNOCK_REQUEST') {
      const currentRoom = roomRef.current
      if (currentRoom?.creatorUsername === user?.username) {
        toast((t) => (
          <div style={{ fontFamily:'var(--mono)' }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>🚪 <strong>{event.sender}</strong> wants to join</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={async () => { toast.dismiss(t.id); try { await publicRoomService.acceptKnock(roomId, event.sender); toast.success(`${event.sender} granted access`) } catch { toast.error('Failed') } }}
                style={{ padding:'5px 14px', background:'var(--success)', border:'none', borderRadius:5, color:'#000', cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, fontWeight:700 }}>ACCEPT</button>
              <button onClick={() => toast.dismiss(t.id)} style={{ padding:'5px 10px', background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text-2)', cursor:'pointer', fontFamily:'var(--mono)', fontSize:11 }}>Dismiss</button>
            </div>
          </div>
        ), { duration:60000, id:`knock-${event.sender}` })
      }
      setMessages(prev => [...prev, { type:'SYSTEM', encryptedPayload:`🚪 ${event.sender} requested to join`, timestamp: new Date().toISOString() }]); return
    }
    if (event.type === 'KNOCK_ACCEPTED') {
      setMessages(prev => [...prev, { type:'SYSTEM', encryptedPayload:`✅ ${event.targetUser || event.sender} joined`, timestamp: new Date().toISOString() }]); return
    }
    setMessages(prev => [...prev, event])
  }, [roomId, triggerBurn, startBurnCountdown, user])

  const { connected, connecting, sendMessage, disconnect } = useWebSocket({
    roomId, onMessage: handleMessage, onHistory: handleHistory,
    onSystemEvent: handleSystemEvent, enabled: wsEnabled && !burned,
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
      if (sendMessage(msg)) { setInputText(''); addOwnMessage(msg); setBurnCountdown(null); clearInterval(countdownRef.current) }
      else toast.error('Connection lost — reconnecting…')
    } catch { toast.error('Encryption failed') }
    finally { setSending(false) }
  }

  // ─── Send file via REST + small WS token ──────────────────────────────────
  const sendFileBlob = async (blob, fileName, mimeType, msgType = 'FILE') => {
    if (blob.size > MAX_FILE_BYTES) { toast.error('File exceeds 5 MB limit'); return }
    if (!connected) { toast.error('Not connected yet'); return }
    setSending(true)
    const tid = toast.loading(`Encrypting ${fileName}…`)
    try {
      const file = new File([blob], fileName, { type: mimeType })
      const { encryptedPayload, iv, fileSize } = await encryptFile(file)
      const binary = atob(encryptedPayload)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const encBlob = new Blob([bytes], { type:'application/octet-stream' })
      toast.dismiss(tid)
      const tid2 = toast.loading(`Uploading ${fileName}…`)
      const { token } = await fileService.upload(roomId, encBlob, iv, fileName, mimeType, fileSize, msgType)
      toast.dismiss(tid2)
      const msg = { type: msgType, fileToken: token, iv, fileName, mimeType, fileSize }
      sendMessage(msg); addOwnMessage(msg)
      toast.success(`${msgType === 'VOICE' ? '🎙' : msgType === 'VIDEO' ? '🎬' : msgType === 'PHOTO' ? '📷' : '📎'} ${fileName} sent`)
    } catch (err) { toast.dismiss(tid); toast.error(err?.response?.data?.message || 'Upload failed') }
    finally { setSending(false) }
  }

  const sendFile = async (file) => sendFileBlob(file, file.name, file.type, 'FILE')
  const handleFileInput = (e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value='' }
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) sendFile(f) }

  // ─── Camera capture handler ────────────────────────────────────────────────
  const handleCameraCapture = async (blob, fileName, mimeType) => {
    const msgType = mimeType.startsWith('video') ? 'VIDEO' : 'PHOTO'
    await sendFileBlob(blob, fileName, mimeType, msgType)
  }

  // ─── Voice recording ───────────────────────────────────────────────────────
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
    await sendFileBlob(audioBlob, 'voice-message.webm', 'audio/webm', 'VOICE')
    setAudioBlob(null)
  }

  const fmtRec = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
  const insertEmoji = (em) => { setInputText(p => p+em); setShowEmoji(false); textareaRef.current?.focus() }

  // ─── Burn ──────────────────────────────────────────────────────────────────
  const handleBurnRoom = async () => {
    setShowBurnConfirm(false); setBurningRoom(true)
    try {
      disconnect(); await roomService.burnRoom(roomId)
      const e = Math.round((Date.now() - sessionStartRef.current) / 1000)
      triggerBurn('Burn requested by you', `${Math.floor(e/60)}m ${e%60}s`)
    } catch (err) { toast.error(err.response?.data?.message || 'Burn failed') }
    finally { setBurningRoom(false) }
  }
  const endSession = () => { disconnect(); navigate('/vault-rooms') }

  // ─── Add participant handler ────────────────────────────────────────────────
  const handleParticipantAdded = (username) => {
    setRoom(prev => prev ? { ...prev, invitedUsernames: [...(prev.invitedUsernames||[]), username], acceptedUsernames: [...(prev.acceptedUsernames||[]), username] } : prev)
    setMessages(prev => [...prev, { type:'SYSTEM', encryptedPayload:`👤 ${username} was added to the vault`, timestamp: new Date().toISOString() }])
  }

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
  const groupName    = room?.groupName

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg-0)', position:'relative' }}>

      {/* Modals */}
      {showCamera && <CameraModal mode={cameraMode} onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      {showAddParticipant && (
        <AddParticipantModal roomId={roomId} existingParticipants={participants} currentUsername={user?.username}
          onClose={() => setShowAddParticipant(false)} onAdded={handleParticipantAdded} />
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div style={{ position:'fixed', inset:0, background:'rgba(255,107,53,0.08)', border:'3px dashed var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, pointerEvents:'none' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🔒</div>
            <span style={{ fontFamily:'var(--mono)', color:'var(--accent)', fontSize:14, letterSpacing:2 }}>DROP TO ENCRYPT & SEND</span>
          </div>
        </div>
      )}

      {/* Burn confirm */}
      {showBurnConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20 }}
          onClick={e => e.target === e.currentTarget && setShowBurnConfirm(false)}>
          <div className="fade-in vv-card" style={{ maxWidth:400, width:'100%', padding:28, textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🔥</div>
            <div style={{ fontFamily:'var(--mono)', fontSize:12, letterSpacing:3, color:'var(--danger)', marginBottom:8 }}>CONFIRM BURN</div>
            <div style={{ fontSize:14, color:'var(--text-1)', marginBottom:8, lineHeight:1.6 }}>This permanently destroys this vault for <strong>all participants</strong>.</div>
            <div style={{ fontSize:12, color:'var(--text-3)', fontFamily:'var(--mono)', marginBottom:24, lineHeight:1.6 }}>Irreversible. A new request must be created to chat again.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => setShowBurnConfirm(false)} className="vv-btn vv-btn-ghost" style={{ padding:'9px 22px', fontSize:12 }}>Cancel</button>
              <button onClick={handleBurnRoom} disabled={burningRoom}
                style={{ padding:'9px 22px', fontSize:12, fontFamily:'var(--mono)', letterSpacing:2, border:'none', borderRadius:6, background:'var(--danger)', color:'#fff', cursor:'pointer', fontWeight:700 }}>
                {burningRoom ? 'BURNING…' : '🔥 BURN NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Burn countdown banner */}
      {burnCountdown !== null && (
        <div style={{ background:'rgba(255,68,85,0.15)', borderBottom:'1px solid var(--danger)', padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>🔥</span>
          <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--danger)', letterSpacing:1 }}>VAULT BURNS IN {burnCountdown}s</span>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom:'1px solid var(--border)', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:10 }}>
        <div style={{ minWidth:0, flex:1 }}>
          {/* Group name + status */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background: connected ? 'var(--success)' : connecting ? '#f5a623' : 'var(--danger)', boxShadow: connected ? '0 0 6px var(--success)' : 'none', flexShrink:0 }} />
            <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text-3)', letterSpacing:2 }}>
              {connected ? 'LIVE' : connecting ? 'CONNECTING…' : 'RECONNECTING…'}
            </span>
          </div>
          {/* Group name — prominent */}
          <div style={{ fontSize:15, fontWeight:700, color:'var(--text-1)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {groupName || '⚡ Vault Room'}
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>
            {participants.length} participants · E2E encrypted
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          {/* Participant avatars */}
          <div style={{ display:'flex', gap:3 }}>
            {participants.slice(0,4).map(p => (
              <div key={p} title={`@${p}`} style={{ width:26, height:26, borderRadius:'50%', background:'var(--accent-dim)', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontFamily:'var(--mono)', color:'var(--accent)', fontWeight:700 }}>
                {p[0].toUpperCase()}
              </div>
            ))}
            {participants.length > 4 && <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--bg-2)', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'var(--text-3)' }}>+{participants.length-4}</div>}
          </div>

          {/* Add participant */}
          <button onClick={() => setShowAddParticipant(true)} title="Add participant"
            style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', borderRadius:6, cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-3)' }}>
            👤+
          </button>

          <button onClick={() => setShowBurnConfirm(true)} disabled={burningRoom}
            style={{ padding:'6px 12px', border:'1px solid var(--danger)', background:'transparent', color:'var(--danger)', borderRadius:6, cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, letterSpacing:1 }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,68,85,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            🔥
          </button>
          <button onClick={endSession}
            style={{ padding:'6px 12px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', borderRadius:6, cursor:'pointer', fontFamily:'var(--mono)', fontSize:11 }}>
            EXIT
          </button>
        </div>
      </div>

      {/* Room ID bar */}
      <div style={{ padding:'4px 14px', background:'var(--bg-1)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text-3)', letterSpacing:1 }}>ROOM · {roomId}</span>
        <span style={{ fontFamily:'var(--mono)', fontSize:9, color: connected ? 'var(--success)' : 'var(--text-3)' }}>
          {connected ? '● AES-256-GCM' : '○ OFFLINE'}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
        onDrop={handleDrop}
      >
        {messages.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--text-3)', fontFamily:'var(--mono)', fontSize:12, letterSpacing:1 }}>
            <div style={{ fontSize:36, marginBottom:14 }}>🔒</div>
            {connecting ? 'ESTABLISHING SECURE CHANNEL…' : connected ? 'VAULT IS EMPTY · SEND THE FIRST MESSAGE' : 'CONNECTING…'}
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={`${msg.timestamp ?? i}-${i}`} message={msg} isOwn={msg.sender === user?.username} roomId={roomId} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{ borderTop:'1px solid var(--border)', padding:'10px 14px', background:'var(--bg-1)', flexShrink:0 }}>

        {/* Voice preview */}
        {audioBlob && !recording && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'8px 12px', background:'var(--bg-2)', border:'1px solid var(--accent)', borderRadius:8 }}>
            <span>🎙</span>
            <audio controls src={URL.createObjectURL(audioBlob)} style={{ flex:1, height:28 }} />
            <button onClick={sendVoice} disabled={!connected||sending} style={{ padding:'5px 14px', background:'var(--accent)', border:'none', borderRadius:6, color:'#000', fontFamily:'var(--mono)', fontSize:11, fontWeight:700, cursor:'pointer', opacity:(!connected||sending)?0.5:1 }}>SEND</button>
            <button onClick={cancelRecording} style={{ padding:'5px 10px', background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-3)', cursor:'pointer' }}>✕</button>
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, padding:'8px 12px', background:'rgba(255,68,85,0.08)', border:'1px solid var(--danger)', borderRadius:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--danger)', animation:'pulse 1s ease-in-out infinite' }} />
            <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--danger)', letterSpacing:1 }}>REC {fmtRec(recordSeconds)}</span>
            <div style={{ display:'flex', gap:2, alignItems:'center', flex:1 }}>
              {Array.from({ length:16 }).map((_,i) => (
                <div key={i} style={{ width:3, borderRadius:2, background:'var(--danger)', opacity:0.6, height:`${6+Math.abs(Math.sin(i*0.7))*10}px`, animation:`pulse ${0.3+(i%4)*0.15}s ease-in-out infinite alternate` }} />
              ))}
            </div>
            <button onClick={stopRecording} style={{ padding:'5px 14px', background:'var(--danger)', border:'none', borderRadius:6, color:'#fff', fontFamily:'var(--mono)', fontSize:11, fontWeight:700, cursor:'pointer' }}>STOP</button>
            <button onClick={cancelRecording} style={{ padding:'5px 10px', background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-3)', cursor:'pointer' }}>✕</button>
          </div>
        )}

        <div style={{ display:'flex', gap:6, alignItems:'flex-end', position:'relative' }}>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}

          {/* Emoji */}
          <button onClick={() => setShowEmoji(p => !p)} disabled={recording}
            style={{ padding:'9px', border:`1px solid ${showEmoji?'var(--accent)':'var(--border)'}`, background: showEmoji?'var(--accent-dim)':'var(--bg-2)', borderRadius:8, cursor:'pointer', fontSize:15, flexShrink:0 }}>
            😊
          </button>

          {/* File attach */}
          <button onClick={() => fileInputRef.current?.click()} disabled={!connected||sending||recording}
            style={{ padding:'9px', border:'1px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', borderRadius:8, cursor:(!connected||recording)?'not-allowed':'pointer', fontSize:15, flexShrink:0, opacity:(!connected||sending||recording)?0.4:1 }}>
            📎
          </button>
          <input ref={fileInputRef} type="file" style={{ display:'none' }} onChange={handleFileInput} />

          {/* Camera photo */}
          <button onClick={() => { setCameraMode('photo'); setShowCamera(true) }} disabled={!connected||sending||recording}
            title="Take photo"
            style={{ padding:'9px', border:'1px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', borderRadius:8, cursor:(!connected||recording)?'not-allowed':'pointer', fontSize:15, flexShrink:0, opacity:(!connected||sending||recording)?0.4:1 }}>
            📷
          </button>

          {/* Camera video */}
          <button onClick={() => { setCameraMode('video'); setShowCamera(true) }} disabled={!connected||sending||recording}
            title="Record video"
            style={{ padding:'9px', border:'1px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', borderRadius:8, cursor:(!connected||recording)?'not-allowed':'pointer', fontSize:15, flexShrink:0, opacity:(!connected||sending||recording)?0.4:1 }}>
            🎬
          </button>

          {/* Voice */}
          <button onClick={recording ? stopRecording : startRecording} disabled={!connected||sending||!!audioBlob}
            style={{ padding:'9px', border:`1px solid ${recording?'var(--danger)':'var(--border)'}`, background: recording?'rgba(255,68,85,0.1)':'var(--bg-2)', color: recording?'var(--danger)':'var(--text-3)', borderRadius:8, cursor:(!connected||!!audioBlob)?'not-allowed':'pointer', fontSize:15, flexShrink:0, opacity:(!connected||sending||!!audioBlob)?0.4:1 }}>
            🎙
          </button>

          {/* Text input */}
          <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendText() }}}
            placeholder={connected ? 'Type a message… (AES-256-GCM)' : 'Connecting…'}
            rows={1} disabled={!connected||sending||recording}
            style={{ flex:1, resize:'none', padding:'10px 12px', background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-1)', fontFamily:'var(--sans)', fontSize:14, lineHeight:1.5, outline:'none', opacity:(!connected||sending||recording)?0.5:1 }}
          />

          {/* Send */}
          <button onClick={sendText} disabled={!connected||sending||!inputText.trim()||recording}
            style={{ padding:'10px 16px', background:'var(--accent)', border:'none', borderRadius:8, cursor:(!connected||sending||!inputText.trim()||recording)?'not-allowed':'pointer', color:'#000', fontFamily:'var(--mono)', fontSize:12, fontWeight:700, letterSpacing:1, flexShrink:0, opacity:(!connected||sending||!inputText.trim()||recording)?0.4:1 }}>
            {sending ? '…' : 'SEND'}
          </button>
        </div>

        <div style={{ marginTop:5, fontSize:9, fontFamily:'var(--mono)', color:'var(--text-3)', letterSpacing:1 }}>
          😊 emoji · 📎 file · 📷 photo · 🎬 video · 🎙 voice · ENTER to send
        </div>
      </div>
    </div>
  )
}
