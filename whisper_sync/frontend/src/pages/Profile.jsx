import React, { useState, useRef, useContext, useEffect } from 'react'
import toast from 'react-hot-toast'
import { AuthContext }   from '../App'
import { authService }   from '../api/authService'
import Navbar            from '../components/Navbar'

const mono = { fontFamily: 'var(--mono)' }
const label = { display:'block', fontSize:10, ...mono, color:'var(--text-3)', letterSpacing:2, marginBottom:8, textTransform:'uppercase', fontWeight:700 }
const card  = { background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, padding:'22px 24px', marginBottom:16 }

/** Compress any image data-url to 64x64 JPEG base64 */
async function compressTo64(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 64
      const ctx = canvas.getContext('2d')
      // Crop to square from center
      const s = Math.min(img.width, img.height)
      const ox = (img.width  - s) / 2
      const oy = (img.height - s) / 2
      ctx.drawImage(img, ox, oy, s, s, 0, 0, 64, 64)
      resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1])
    }
    img.src = dataUrl
  })
}

// ─── Ghost Avatar SVG ────────────────────────────────────────────────────────
function GhostAvatar({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="32" fill="var(--bg-3)" />
      <ellipse cx="32" cy="26" rx="13" ry="14" fill="var(--text-3)" />
      <path d="M19 38 Q19 52 27 52 Q32 44 32 44 Q32 44 37 52 Q45 52 45 38 Q45 26 32 26 Q19 26 19 38Z" fill="var(--text-3)" />
      <circle cx="27" cy="28" r="2.5" fill="var(--bg-3)" />
      <circle cx="37" cy="28" r="2.5" fill="var(--bg-3)" />
    </svg>
  )
}

// ─── Face Scan Camera ─────────────────────────────────────────────────────────
function FaceScanCamera({ onCapture, onCancel }) {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } })
      .then(stream => { streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream })
      .catch(() => { toast.error('Camera access denied'); onCancel() })
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, []) // eslint-disable-line

  const startScan = () => {
    setScanning(true)
    let c = 3
    setCountdown(c)
    const iv = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        clearInterval(iv)
        capture()
      }
    }, 1000)
  }

  const capture = async () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth  || 320
    canvas.height = video.videoHeight || 240
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const b64 = await compressTo64(dataUrl)
    streamRef.current?.getTracks().forEach(t => t.stop())
    onCapture(b64)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}>
      <div className="fade-in" style={{ background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:12, padding:28, maxWidth:380, width:'100%', textAlign:'center' }}>
        <div style={{ ...mono, fontSize:11, letterSpacing:3, color:'var(--accent)', marginBottom:12 }}>FACE SCAN</div>
        <div style={{ position:'relative', marginBottom:16, borderRadius:8, overflow:'hidden', background:'#000' }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', display:'block', transform:'scaleX(-1)' }} />
          {/* Scan overlay */}
          <div style={{ position:'absolute', inset:0, border:'2px solid var(--accent)', borderRadius:8, pointerEvents:'none', boxShadow:'inset 0 0 20px rgba(255,107,53,0.15)' }}>
            {/* Corner brackets */}
            {[['top:0','left:0'], ['top:0','right:0'], ['bottom:0','left:0'], ['bottom:0','right:0']].map(([t, s], i) => (
              <div key={i} style={{ position:'absolute', [t.split(':')[0]]:t.split(':')[1], [s.split(':')[0]]:s.split(':')[1], width:20, height:20,
                borderTop: t.includes('top') ? '3px solid var(--accent)' : 'none',
                borderBottom: t.includes('bottom') ? '3px solid var(--accent)' : 'none',
                borderLeft: s.includes('left') ? '3px solid var(--accent)' : 'none',
                borderRight: s.includes('right') ? '3px solid var(--accent)' : 'none',
              }} />
            ))}
          </div>
          {/* Scan line animation */}
          {scanning && (
            <div style={{ position:'absolute', left:0, right:0, height:2, background:'var(--accent)', opacity:0.8, animation:'scanLine 1.5s ease-in-out infinite', top:'50%', boxShadow:'0 0 8px var(--accent)' }} />
          )}
          {/* Countdown */}
          {countdown !== null && countdown > 0 && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)' }}>
              <span style={{ fontSize:72, fontWeight:700, color:'var(--accent)', ...mono }}>{countdown}</span>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display:'none' }} />
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button onClick={onCancel} className="vv-btn vv-btn-ghost" style={{ padding:'8px 20px', fontSize:11 }}>Cancel</button>
          <button onClick={startScan} disabled={scanning}
            style={{ padding:'8px 20px', background:'var(--accent)', border:'none', borderRadius:6, color:'#000', ...mono, fontSize:11, fontWeight:700, letterSpacing:2, cursor:scanning?'wait':'pointer' }}>
            {scanning ? 'SCANNING…' : '⬤ SCAN FACE'}
          </button>
        </div>
        <p style={{ marginTop:12, fontSize:11, color:'var(--text-3)', ...mono }}>Image is compressed to 64×64px locally — never sent raw</p>
      </div>
    </div>
  )
}

// ─── Main Profile Page ────────────────────────────────────────────────────────
export default function Profile() {
  const { user, setUser }            = useContext(AuthContext)
  const fileInputRef                 = useRef(null)
  const [showCamera, setShowCamera]  = useState(false)
  const [saving, setSaving]          = useState(false)
  const [tab, setTab]                = useState('identity') // identity | security

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio]                 = useState(user?.bio || '')
  const [avatarB64, setAvatarB64]     = useState(user?.avatarBase64 || null)
  const [avatarMode, setAvatarMode]   = useState(user?.avatarMode || 'GHOST')

  // Password form
  const [currPw, setCurrPw]   = useState('')
  const [newPw, setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving]   = useState(false)
  const [showPws, setShowPws]     = useState(false)

  const avatarSrc = avatarMode === 'FACE' && avatarB64 ? `data:image/jpeg;base64,${avatarB64}` : null

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const b64 = await compressTo64(ev.target.result)
      setAvatarB64(b64)
      setAvatarMode('FACE')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleFaceScan = (b64) => {
    setAvatarB64(b64)
    setAvatarMode('FACE')
    setShowCamera(false)
    toast.success('Face captured and compressed to 64×64')
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const updated = await authService.updateProfile({
        displayName, bio,
        avatarBase64: avatarB64 || '',
        avatarMode,
      })
      setUser(u => ({ ...u, ...updated }))
      toast.success('Profile saved')
    } catch { toast.error('Failed to save profile') }
    finally { setSaving(false) }
  }

  const savePassword = async () => {
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8)    { toast.error('New password must be at least 8 characters'); return }
    setPwSaving(true)
    try {
      await authService.changePassword(currPw, newPw)
      toast.success('Password changed successfully')
      setCurrPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed')
    } finally { setPwSaving(false) }
  }

  const pwStrength = (pw) => {
    if (!pw) return null
    let score = 0
    if (pw.length >= 8)  score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 2) return { label:'WEAK',   color:'var(--danger)',  w:'33%' }
    if (score <= 3) return { label:'FAIR',   color:'#f5a623',       w:'60%' }
    return               { label:'STRONG', color:'var(--success)', w:'100%' }
  }
  const strength = pwStrength(newPw)

  return (
    <div>
      {showCamera && <FaceScanCamera onCapture={handleFaceScan} onCancel={() => setShowCamera(false)} />}
      <Navbar title="Vault Identity" subtitle="Manage your profile, avatar, and credentials" />
      <div style={{ padding:'24px 40px', maxWidth:640 }}>

        {/* Tab switcher */}
        <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-1)', padding:4, borderRadius:8, border:'1px solid var(--border)', width:'fit-content' }}>
          {[['identity','👤 Identity'], ['security','🔐 Security']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'6px 18px', borderRadius:6, border:'none', cursor:'pointer', ...mono, fontSize:11, letterSpacing:1, fontWeight:700, transition:'all 0.15s',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color:      tab === t ? '#000'          : 'var(--text-3)',
            }}>{l}</button>
          ))}
        </div>

        {/* ── IDENTITY TAB ── */}
        {tab === 'identity' && (
          <>
            {/* Avatar section */}
            <div style={card}>
              <div style={{ ...mono, fontSize:10, letterSpacing:3, color:'var(--text-3)', marginBottom:16 }}>VAULT AVATAR</div>
              <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
                {/* Preview */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', border:'2px solid var(--accent)', background:'var(--bg-3)' }}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <GhostAvatar size={80} />}
                  </div>
                  {avatarMode === 'FACE' && (
                    <div style={{ position:'absolute', bottom:2, right:2, width:16, height:16, borderRadius:'50%', background:'var(--success)', border:'2px solid var(--bg-1)', boxShadow:'0 0 4px var(--success)' }} />
                  )}
                </div>

                {/* Controls */}
                <div style={{ flex:1 }}>
                  {/* Mode toggle */}
                  <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                    {[['FACE','⬤ Face Avatar'], ['GHOST','👻 Privacy Mode']].map(([m, l]) => (
                      <button key={m} onClick={() => setAvatarMode(m)} style={{ padding:'6px 14px', border:`1px solid ${avatarMode===m ? 'var(--accent)' : 'var(--border)'}`, borderRadius:6, background: avatarMode===m ? 'var(--accent-dim)' : 'var(--bg-2)', color: avatarMode===m ? 'var(--accent)' : 'var(--text-3)', cursor:'pointer', ...mono, fontSize:11, letterSpacing:1, transition:'all 0.15s' }}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button onClick={() => setShowCamera(true)} style={{ padding:'7px 14px', border:'1px solid var(--border)', background:'var(--bg-2)', borderRadius:6, color:'var(--text-2)', cursor:'pointer', ...mono, fontSize:11, letterSpacing:1, transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                      📷 Scan Face
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} style={{ padding:'7px 14px', border:'1px solid var(--border)', background:'var(--bg-2)', borderRadius:6, color:'var(--text-2)', cursor:'pointer', ...mono, fontSize:11, letterSpacing:1, transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                      ↑ Upload Photo
                    </button>
                    {avatarB64 && <button onClick={() => { setAvatarB64(null); setAvatarMode('GHOST') }} style={{ padding:'7px 14px', border:'1px solid var(--border)', background:'transparent', borderRadius:6, color:'var(--text-3)', cursor:'pointer', ...mono, fontSize:11 }}>
                      Remove
                    </button>}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileUpload} />
                  <p style={{ marginTop:10, fontSize:11, color:'var(--text-3)', ...mono }}>
                    Compressed to 64×64 JPEG locally — stored as Base64 in your Vault Identity
                  </p>
                </div>
              </div>
            </div>

            {/* Profile form */}
            <div style={card}>
              <div style={{ ...mono, fontSize:10, letterSpacing:3, color:'var(--text-3)', marginBottom:16 }}>PROFILE INFO</div>
              <div style={{ marginBottom:16 }}>
                <label style={label}>Display Name</label>
                <input className="vv-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" maxLength={40} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={label}>Username</label>
                <input className="vv-input" value={user?.username || ''} disabled style={{ opacity:0.5, cursor:'not-allowed' }} />
                <div style={{ fontSize:10, color:'var(--text-3)', ...mono, marginTop:4 }}>Username cannot be changed</div>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={label}>Bio <span style={{ color:'var(--text-3)', fontWeight:400 }}>(optional)</span></label>
                <textarea className="vv-input" value={bio} onChange={e => setBio(e.target.value)} placeholder="A short vault identity bio…" rows={2} maxLength={160} style={{ resize:'vertical', ...mono, fontSize:12 }} />
                <div style={{ textAlign:'right', fontSize:10, color:'var(--text-3)', ...mono, marginTop:3 }}>{bio.length}/160</div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={label}>Email</label>
                <input className="vv-input" value={user?.email || ''} disabled style={{ opacity:0.5, cursor:'not-allowed' }} />
              </div>
              <button onClick={saveProfile} disabled={saving} className="vv-btn vv-btn-primary" style={{ padding:'10px 24px', letterSpacing:2, fontSize:12 }}>
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>

            {/* Member since */}
            <div style={{ padding:'10px 16px', background:'var(--bg-1)', border:'1px solid var(--border)', borderRadius:8, display:'flex', gap:20 }}>
              {[['Member Since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'],
                ['Last Login', user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—']].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize:10, color:'var(--text-3)', ...mono, letterSpacing:1, marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:12, color:'var(--text-2)', ...mono }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === 'security' && (
          <>
            <div style={card}>
              <div style={{ ...mono, fontSize:10, letterSpacing:3, color:'var(--text-3)', marginBottom:16 }}>PASSWORD ROTATION</div>
              <p style={{ fontSize:12, color:'var(--text-2)', marginBottom:20, lineHeight:1.6 }}>
                A BCrypt-verified rotation flow. Your current password must be confirmed before a new hash is generated and stored.
              </p>

              <div style={{ marginBottom:14 }}>
                <label style={label}>Current Password</label>
                <div style={{ position:'relative' }}>
                  <input className="vv-input" type={showPws ? 'text' : 'password'} value={currPw} onChange={e => setCurrPw(e.target.value)} placeholder="Your current password" style={{ paddingRight:40 }} />
                  <button onClick={() => setShowPws(p => !p)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:15 }}>
                    {showPws ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={label}>New Password</label>
                <input className="vv-input" type={showPws ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
                {newPw && (
                  <div style={{ marginTop:6 }}>
                    <div style={{ height:3, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:strength?.w, background:strength?.color, borderRadius:2, transition:'width 0.3s, background 0.3s' }} />
                    </div>
                    <div style={{ fontSize:10, color:strength?.color, ...mono, marginTop:3, letterSpacing:1 }}>{strength?.label}</div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={label}>Confirm New Password</label>
                <input className="vv-input" type={showPws ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password"
                  style={{ borderColor: confirmPw && confirmPw !== newPw ? 'var(--danger)' : undefined }} />
                {confirmPw && confirmPw !== newPw && (
                  <div style={{ fontSize:11, color:'var(--danger)', ...mono, marginTop:4 }}>Passwords do not match</div>
                )}
              </div>

              <button onClick={savePassword} disabled={pwSaving || !currPw || !newPw || newPw !== confirmPw}
                className="vv-btn vv-btn-primary" style={{ padding:'10px 24px', letterSpacing:2, fontSize:12 }}>
                {pwSaving ? 'Rotating…' : '🔐 Rotate Password'}
              </button>
            </div>

            {/* Security callouts */}
            <div style={card}>
              <div style={{ ...mono, fontSize:10, letterSpacing:3, color:'var(--text-3)', marginBottom:14 }}>SECURITY STATUS</div>
              {[
                { icon:'🔒', label:'AES-256-GCM Encryption',     sub:'All secrets encrypted at rest and in transit' },
                { icon:'🔑', label:'BCrypt Password Hashing',     sub:'Cost factor 12 — industry standard' },
                { icon:'⚡', label:'JWT Stateless Auth',          sub:`Expires in 24h — re-login required` },
                { icon:'📧', label:'Email Notifications',         sub: user?.emailNotificationsEnabled ? 'Enabled' : 'Disabled', action: true },
              ].map(({ icon, label: l, sub, action }) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', ...mono }}>{sub}</div>
                  </div>
                  {action && (
                    <button onClick={async () => {
                      const updated = await authService.toggleNotifications(!user?.emailNotificationsEnabled)
                      setUser(u => ({ ...u, ...updated }))
                    }} style={{ padding:'4px 12px', border:`1px solid ${user?.emailNotificationsEnabled ? 'var(--success)' : 'var(--border)'}`, borderRadius:20, background:'transparent', color: user?.emailNotificationsEnabled ? 'var(--success)' : 'var(--text-3)', cursor:'pointer', ...mono, fontSize:10, letterSpacing:1 }}>
                      {user?.emailNotificationsEnabled ? 'ON' : 'OFF'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Scan line CSS */}
      <style>{`@keyframes scanLine { 0%{top:10%} 50%{top:90%} 100%{top:10%} }`}</style>
    </div>
  )
}
