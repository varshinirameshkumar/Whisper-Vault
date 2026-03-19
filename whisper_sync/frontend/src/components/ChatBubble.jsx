import React, { useState, useEffect, useRef } from 'react'
import { useCrypto } from '../hooks/useCrypto'
import { fileService } from '../api/fileService'

const fmtTime = (ts) => {
  try { return new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) }
  catch { return '' }
}
const fmtSize = (b) => {
  if (!b) return ''
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}
const fmtDur = (s) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.round(s % 60).toString().padStart(2, '0')}`

const getType = (t) => (t || 'TEXT').toString().toUpperCase()

// ─── Fetch + decrypt helper ───────────────────────────────────────────────────
// Works for both token-based (REST) and legacy payload-based messages
async function fetchAndDecrypt(message, decryptFile) {
  if (message.fileToken) {
    // New flow: fetch encrypted bytes from REST, decrypt with iv from WS message
    const { encryptedBytes, mimeType } = await fileService.download(message.fileToken)
    return decryptFile(encryptedBytes, message.iv, message.mimeType || mimeType, true) // true = raw ArrayBuffer
  } else if (message.encryptedPayload && message.iv) {
    // Legacy flow: payload was sent inline over WebSocket (small files)
    return decryptFile(message.encryptedPayload, message.iv, message.mimeType, false)
  }
  return null
}

// ─── Voice Player ──────────────────────────────────────────────────────────────
function VoicePlayer({ message, isOwn, roomId }) {
  const { decryptFile }             = useCrypto(roomId)
  const [blobUrl, setBlobUrl]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [playing, setPlaying]       = useState(false)
  const [progress, setProgress]     = useState(0)
  const [duration, setDuration]     = useState(0)
  const audioRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)

    fetchAndDecrypt(message, decryptFile)
      .then(blob => {
        if (cancelled || !blob) { if (!cancelled) setError(true); return }
        setBlobUrl(URL.createObjectURL(blob))
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [message.fileToken, message.encryptedPayload]) // eslint-disable-line

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !blobUrl) return
    const bind = (ev, fn) => { audio.addEventListener(ev, fn); return () => audio.removeEventListener(ev, fn) }
    const cleanups = [
      bind('play',            () => setPlaying(true)),
      bind('pause',           () => setPlaying(false)),
      bind('ended',           () => { setPlaying(false); setProgress(0) }),
      bind('timeupdate',      () => setProgress(audio.currentTime)),
      bind('loadedmetadata',  () => setDuration(isFinite(audio.duration) ? audio.duration : 0)),
    ]
    return () => cleanups.forEach(fn => fn())
  }, [blobUrl])

  const togglePlay = () => {
    if (!audioRef.current) return
    playing ? audioRef.current.pause() : audioRef.current.play()
  }
  const scrub = (e) => {
    if (!audioRef.current || !duration) return
    const r = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - r.left) / r.width) * duration
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0
  const fg  = isOwn ? 'rgba(0,0,0,0.8)' : 'var(--accent)'
  const trk = isOwn ? 'rgba(0,0,0,0.2)' : 'var(--bg-3)'

  if (error) return <div style={{ fontSize:12, fontFamily:'var(--mono)', opacity:0.5 }}>🎙 [voice unavailable]</div>

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:220, maxWidth:300 }}>
      {blobUrl && <audio ref={audioRef} src={blobUrl} preload="auto" style={{ display:'none' }} />}

      <button onClick={togglePlay} disabled={loading || !blobUrl}
        style={{ width:36, height:36, borderRadius:'50%', border:`2px solid ${fg}`, background:'transparent',
          cursor: loading ? 'wait' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0, color:fg, fontSize:13, transition:'all 0.15s' }}>
        {loading ? <span style={{ fontFamily:'var(--mono)', fontSize:9, color:fg }}>…</span>
                 : playing ? '⏸' : '▶'}
      </button>

      <div style={{ flex:1 }}>
        <div onClick={scrub}
          style={{ height:4, background:trk, borderRadius:3, overflow:'hidden', cursor:'pointer', marginBottom:5 }}>
          <div style={{ width:`${pct}%`, height:'100%', background:fg, borderRadius:3, transition:'width 0.1s linear' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:10, fontFamily:'var(--mono)', color:fg, opacity:0.7 }}>{fmtDur(progress)}</span>
          <span style={{ fontSize:10, fontFamily:'var(--mono)', color:fg, opacity:0.7 }}>
            {duration > 0 ? fmtDur(duration) : loading ? '…' : '--:--'}
          </span>
        </div>
      </div>
      <span style={{ fontSize:16 }}>🎙</span>
    </div>
  )
}

// ─── File Card ─────────────────────────────────────────────────────────────────
function FileCard({ message, isOwn, roomId }) {
  const { decryptFile }    = useCrypto(roomId)
  const [state, setState]  = useState('idle')  // idle | loading | done | error

  const handleDownload = async () => {
    if (state !== 'idle') return
    setState('loading')
    try {
      const blob = await fetchAndDecrypt(message, decryptFile)
      if (!blob) { setState('error'); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = message.fileName || 'file'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setState('done')
    } catch { setState('error') }
  }

  const ext  = (message.fileName || '').split('.').pop()?.toUpperCase() || 'FILE'
  const icon = /^(MP4|MOV|AVI|WEBM)$/.test(ext)          ? '🎬'
             : /^(JPG|JPEG|PNG|GIF|WEBP|SVG)$/.test(ext) ? '🖼'
             : /^PDF$/.test(ext)                          ? '📄'
             : /^(ZIP|RAR|7Z|TAR|GZ)$/.test(ext)         ? '🗜'
             : /^(MP3|WAV|OGG|FLAC|M4A)$/.test(ext)      ? '🎵'
             : /^(DOC|DOCX|XLS|XLSX)$/.test(ext)         ? '📋'
             : '📎'

  const btnLabel = { idle:'↓', loading:'⏳', done:'✓', error:'✕' }[state]
  const btnColor = state==='done' ? 'var(--success)' : state==='error' ? 'var(--danger)' : isOwn ? '#000' : 'var(--text-2)'

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:180, maxWidth:280 }}>
      <div style={{ width:40, height:40, borderRadius:8, background: isOwn ? 'rgba(0,0,0,0.15)' : 'var(--bg-3)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>
          {message.fileName || 'Encrypted file'}
        </div>
        <div style={{ fontSize:11, opacity:0.65, fontFamily:'var(--mono)' }}>
          {fmtSize(message.fileSize)} · {ext}
        </div>
      </div>
      <button onClick={handleDownload} disabled={state !== 'idle'}
        style={{ flexShrink:0, width:32, height:32, border:`1.5px solid ${isOwn?'rgba(0,0,0,0.3)':'var(--border)'}`,
          background:'transparent', borderRadius:8,
          cursor: state==='idle' ? 'pointer' : 'default',
          fontSize:14, color:btnColor, transition:'all 0.15s',
          display:'flex', alignItems:'center', justifyContent:'center' }}
        onMouseEnter={e => state==='idle' && (e.currentTarget.style.background = isOwn?'rgba(0,0,0,0.1)':'var(--bg-3)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
        {btnLabel}
      </button>
    </div>
  )
}

// ─── Main ChatBubble ───────────────────────────────────────────────────────────
export default function ChatBubble({ message, isOwn, roomId }) {
  const { decrypt }             = useCrypto(roomId)
  const [plaintext, setPlaintext] = useState(null)
  const type = getType(message.type)

  useEffect(() => {
    if (type === 'TEXT' && message.encryptedPayload && message.iv) {
      decrypt(message.encryptedPayload, message.iv).then(setPlaintext)
    }
  }, [message.encryptedPayload, message.iv, type]) // eslint-disable-line

  // System events
  if (['JOIN','LEAVE','SYSTEM'].includes(type)) {
    return (
      <div style={{ textAlign:'center', margin:'6px 0' }}>
        <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text-3)', letterSpacing:1 }}>
          {type==='JOIN' ? '→ ' : type==='LEAVE' ? '← ' : '⚙ '}{message.encryptedPayload}
        </span>
      </div>
    )
  }

  const isVoice = type === 'VOICE'
  const isFile  = type === 'FILE'
  const isText  = !isVoice && !isFile

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom:12 }}>
      {!isOwn && (
        <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text-3)', marginBottom:3, letterSpacing:1 }}>
          @{message.sender}
        </div>
      )}
      <div style={{
        maxWidth:'72%',
        padding: isText ? '10px 14px' : '10px 12px',
        background: isOwn ? 'var(--accent)' : 'var(--bg-2)',
        color:      isOwn ? '#000'          : 'var(--text-1)',
        borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        border:     isOwn ? 'none' : '1px solid var(--border)',
        wordBreak:  'break-word',
      }}>
        {isVoice && <VoicePlayer message={message} isOwn={isOwn} roomId={roomId} />}
        {isFile  && <FileCard   message={message} isOwn={isOwn} roomId={roomId} />}
        {isText  && (
          <div style={{ fontSize:14, lineHeight:1.55 }}>
            {plaintext === null
              ? <span style={{ opacity:0.4, fontFamily:'var(--mono)', fontSize:11 }}>decrypting…</span>
              : plaintext}
          </div>
        )}
      </div>
      <div style={{ fontSize:10, color:'var(--text-3)', fontFamily:'var(--mono)', marginTop:3 }}>
        {fmtTime(message.timestamp)}
      </div>
    </div>
  )
}
