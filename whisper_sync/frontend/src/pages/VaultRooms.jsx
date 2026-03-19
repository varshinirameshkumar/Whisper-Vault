import React, { useState, useEffect, useContext } from 'react'
import { useNavigate }    from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthContext }    from '../App'
import { roomService }    from '../api/roomService'
import GroupRoomModal     from '../components/GroupRoomModal'
import Navbar             from '../components/Navbar'

const fmtTime = (ts) => {
  try { return new Date(ts).toLocaleString() } catch { return '' }
}

export default function VaultRooms() {
  const { user }                  = useContext(AuthContext)
  const navigate                  = useNavigate()
  const [rooms, setRooms]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    try {
      const data = await roomService.listMyRooms()
      // Backend already filters BURNED — but double-filter client side too
      setRooms((data || []).filter(r => r.status !== 'BURNED'))
    } catch { toast.error('Failed to load vault rooms') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleJoin = async (room) => {
    try {
      await roomService.joinRoom(room.id)
      navigate(`/vault-rooms/${room.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not join room')
    }
  }

  const handleRoomCreated = (room) => {
    load()
    navigate(`/vault-rooms/${room.roomId}`)
  }

  const handleSendSecret = (targetUser) => {
    navigate('/dashboard', { state: { recipient: targetUser } })
  }

  // Active rooms = PENDING or ACTIVE, user is accepted
  const activeRooms = rooms.filter(r => r.status !== 'BURNED')

  return (
    <div>
      <Navbar
        title="Vault Rooms"
        subtitle="Ephemeral group chats — one-time use, zero trace on exit"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="vv-btn vv-btn-primary"
            style={{ padding: '8px 18px', fontSize: 12, letterSpacing: 2 }}
          >
            + NEW CONNECTION
          </button>
        }
      />

      <div style={{ padding: '24px 40px', maxWidth: 760 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="vault-spinner" />
          </div>
        ) : activeRooms.length === 0 ? (
          <div className="vv-card fade-in" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: 2, color: 'var(--text-3)', marginBottom: 8 }}>
              NO ACTIVE VAULT ROOMS
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>
              Each connection is one-time only. Start a new one to chat again.
            </div>
            <button onClick={() => setShowModal(true)} className="vv-btn vv-btn-primary" style={{ padding: '10px 24px' }}>
              Create Vault Room
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeRooms.map(room => {
              const hasAccepted = room.acceptedUsernames?.includes(user?.username)
              const isPending   = room.status === 'PENDING'
              const isActive    = room.status === 'ACTIVE'

              return (
                <div key={room.id} className="vv-card fade-in" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {/* Status badge */}
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1,
                        background: isPending ? 'rgba(245,166,35,0.1)' : 'var(--success-dim)',
                        color:      isPending ? '#f5a623'               : 'var(--success)',
                      }}>
                        {isPending ? 'PENDING' : 'ACTIVE'}
                      </span>
                      {room.creatorUsername === user?.username && (
                        <span style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1 }}>CREATOR</span>
                      )}
                      {/* One-time badge */}
                      <span style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--bg-3)', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1, border: '1px solid var(--border)' }}>
                        ONE-TIME
                      </span>
                    </div>

                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)', letterSpacing: 1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {room.id}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span>👥 {room.invitedUsernames?.length || 0} invited · {room.acceptedUsernames?.length || 0} accepted</span>
                      <span>🕐 {fmtTime(room.createdAt)}</span>
                    </div>

                    {/* Participant chips — green = accepted */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(room.invitedUsernames || []).slice(0, 6).map(p => (
                        <span key={p} style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontFamily: 'var(--mono)',
                          background: room.acceptedUsernames?.includes(p) ? 'var(--success-dim)' : 'var(--bg-3)',
                          color:      room.acceptedUsernames?.includes(p) ? 'var(--success)'     : 'var(--text-3)',
                          border: '1px solid ' + (room.acceptedUsernames?.includes(p) ? 'transparent' : 'var(--border)'),
                        }}>@{p}</span>
                      ))}
                      {(room.invitedUsernames?.length || 0) > 6 && (
                        <span style={{ padding: '2px 8px', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                          +{room.invitedUsernames.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action — only show ENTER if user is accepted. No re-entry after burn */}
                  <div style={{ flexShrink: 0 }}>
                    {hasAccepted ? (
                      <button
                        onClick={() => navigate(`/vault-rooms/${room.id}`)}
                        className="vv-btn vv-btn-primary"
                        style={{ padding: '8px 18px', fontSize: 11, letterSpacing: 2 }}
                      >
                        ENTER
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(room)}
                        className="vv-btn vv-btn-ghost"
                        style={{ padding: '8px 18px', fontSize: 11, letterSpacing: 2 }}
                      >
                        JOIN
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Security note */}
        <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', letterSpacing: 1, marginBottom: 6 }}>ONE-TIME VAULT POLICY</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            Each vault room is <strong style={{ color: 'var(--text-1)' }}>one-time use only</strong>. Once burned, it disappears from this list and cannot be re-entered. To chat again, create a new connection. All content is ephemeral — never written to disk.
          </div>
        </div>
      </div>

      {showModal && (
        <GroupRoomModal
          currentUsername={user?.username}
          onClose={() => setShowModal(false)}
          onRoomCreated={handleRoomCreated}
          onSendSecret={handleSendSecret}
        />
      )}
    </div>
  )
}
