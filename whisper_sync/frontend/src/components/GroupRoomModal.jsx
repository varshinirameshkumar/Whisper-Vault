import React, { useState, useRef, useEffect, useCallback } from 'react'
import { secretService } from '../api/secretService'
import { roomService }   from '../api/roomService'
import toast from 'react-hot-toast'

const labelStyle = {
  display:'block', fontSize:10, fontFamily:'var(--mono)',
  color:'var(--text-3)', letterSpacing:2, marginBottom:8,
  textTransform:'uppercase', fontWeight:700,
}

function MultiUserSearch({ selectedUsers, onAdd, currentUsername, placeholder = 'Search to add participants…' }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const debounceRef           = useRef(null)
  const wrapperRef            = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback((q) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const users = await secretService.searchUsers(q)
        setResults(users.filter(u =>
          u.username !== currentUsername &&
          !selectedUsers.find(s => s.username === u.username)
        ))
        setOpen(true)
      } catch { setResults([]) } finally { setLoading(false) }
    }, 280)
  }, [selectedUsers, currentUsername])

  return (
    <div ref={wrapperRef} style={{ position:'relative' }}>
      <input className="vv-input" value={query}
        onChange={e => { setQuery(e.target.value); search(e.target.value) }}
        placeholder={placeholder} autoComplete="off"
        style={{ paddingRight: loading ? 36 : 12 }}
      />
      {loading && (
        <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
          <div style={{ width:14, height:14, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'vault-spin 0.6s linear infinite' }} />
        </div>
      )}
      {open && results.length > 0 && (
        <div className="scale-in" style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', zIndex:300, maxHeight:200, overflowY:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
          {results.map(u => (
            <div key={u.id} onMouseDown={() => { onAdd(u); setQuery(''); setResults([]); setOpen(false) }}
              style={{ padding:'10px 14px', cursor:'pointer', display:'flex', gap:10, alignItems:'center', borderBottom:'1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent-dim)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', fontFamily:'var(--mono)', fontSize:12, fontWeight:700 }}>
                {(u.displayName || u.username)[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:13, color:'var(--text-1)', fontWeight:500 }}>{u.displayName || u.username}</div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)' }}>@{u.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GroupRoomModal({ currentUsername, onClose, onRoomCreated, onSendSecret }) {
  const [selected, setSelected]   = useState([])
  const [groupName, setGroupName] = useState('')
  const [mode, setMode]           = useState(null)
  const [loading, setLoading]     = useState(false)

  const addUser    = (u) => setSelected(p => [...p, u])
  const removeUser = (u) => setSelected(p => p.filter(x => x.username !== u.username))

  const handleAction = async (chosenMode) => {
    if (selected.length === 0) { toast.error('Select at least one participant'); return }
    if (chosenMode === 'secret' && selected.length > 1) { toast.error('Secret messages go to one recipient'); return }
    setLoading(true)
    try {
      if (chosenMode === 'secret') {
        onSendSecret(selected[0]); onClose()
      } else {
        const room = await roomService.createRoom(selected.map(u => u.username), groupName.trim() || null)
        toast.success(`Vault room "${groupName || 'Untitled'}" created! Invites sent.`)
        onRoomCreated(room); onClose()
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Action failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in vv-card" style={{ width:'100%', maxWidth:480, padding:28, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, letterSpacing:3, color:'var(--accent)', marginBottom:4 }}>WHISPER-SYNC</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text-1)' }}>New Connection</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>

        {/* Group Name */}
        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>Group Name <span style={{ color:'var(--text-3)', fontWeight:400 }}>(optional)</span></label>
          <input className="vv-input" value={groupName} onChange={e => setGroupName(e.target.value)}
            placeholder="e.g. Project Team, Friends, Ops…" maxLength={40} />
        </div>

        {/* Multi-user search */}
        <div style={{ marginBottom:16 }}>
          <label style={labelStyle}>Add Participants</label>
          <MultiUserSearch selectedUsers={selected} onAdd={addUser} currentUsername={currentUsername} />
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
            {selected.map(u => (
              <div key={u.username} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'var(--accent-dim)', border:'1px solid var(--accent)', borderRadius:20, fontSize:12, fontFamily:'var(--mono)', color:'var(--accent)' }}>
                @{u.username}
                <button onClick={() => removeUser(u)} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {selected.length > 0 && (
          <div>
            <label style={{ ...labelStyle, marginBottom:12 }}>Choose Action</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <button onClick={() => handleAction('secret')} disabled={loading || selected.length > 1}
                style={{ padding:'16px 12px', border:'1px solid var(--border)', background:'var(--bg-2)', borderRadius:'var(--radius)', cursor: selected.length > 1 ? 'not-allowed' : 'pointer', opacity: selected.length > 1 ? 0.4 : 1, textAlign:'left', transition:'all var(--transition)' }}
                onMouseEnter={e => { if (selected.length === 1) e.currentTarget.style.borderColor='var(--accent)' }}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ fontSize:22, marginBottom:6 }}>🔐</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Secret Message</div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)' }}>AES encrypted · Burns on read</div>
              </button>
              <button onClick={() => handleAction('room')} disabled={loading}
                style={{ padding:'16px 12px', border:'1px solid var(--border)', background:'var(--bg-2)', borderRadius:'var(--radius)', cursor:'pointer', textAlign:'left', transition:'all var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ fontSize:22, marginBottom:6 }}>⚡</div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-1)', marginBottom:3 }}>Secret Chat Room</div>
                <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)' }}>Real-time · E2E · Ephemeral</div>
              </button>
            </div>
            {loading && <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}><div className="vault-spinner" /></div>}
          </div>
        )}

        {selected.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-3)', fontFamily:'var(--mono)', fontSize:12, letterSpacing:1 }}>
            SEARCH AND SELECT PARTICIPANTS ABOVE
          </div>
        )}
      </div>
    </div>
  )
}
