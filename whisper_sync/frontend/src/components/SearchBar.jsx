import React, { useState, useRef, useEffect, useCallback } from 'react'
import { secretService } from '../api/secretService'

export default function SearchBar({ onSelect, selectedUser, onClear }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const debounceRef           = useRef(null)
  const wrapperRef            = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
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
        setResults(users)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    if (selectedUser) onClear?.()
    search(val)
  }

  const handleSelect = (user) => {
    onSelect(user)
    setQuery(user.username)
    setOpen(false)
    setResults([])
  }

  const displayValue = selectedUser ? selectedUser.username : query

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="vv-input"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by username or display name..."
          autoComplete="off"
          style={{ paddingRight: 36 }}
        />
        {loading && (
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          }}>
            <div style={{
              width: 14, height: 14,
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'vault-spin 0.6s linear infinite',
            }} />
          </div>
        )}
        {selectedUser && (
          <button
            type="button"
            onClick={() => { onClear?.(); setQuery('') }}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-3)',
              cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2,
            }}
          >×</button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="scale-in" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', zIndex: 200,
          maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {results.map(u => (
            <div
              key={u.id}
              onMouseDown={() => handleSelect(u)}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                display: 'flex', gap: 12, alignItems: 'center',
                transition: 'background var(--transition)',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--accent-dim)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)', fontFamily: 'var(--mono)',
                fontSize: 13, fontWeight: 700,
              }}>
                {(u.displayName || u.username)[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-1)', fontWeight: 500 }}>
                  {u.displayName || u.username}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--text-3)',
                  fontFamily: 'var(--mono)', marginTop: 1,
                }}>
                  @{u.username}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && !loading && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px',
          fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--mono)',
          letterSpacing: 1,
        }}>
          NO USERS FOUND
        </div>
      )}
    </div>
  )
}