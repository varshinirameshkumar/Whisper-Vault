import { useState, useEffect, useCallback } from 'react'
import { secretService } from '../api/secretService'

export function useStats() {
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(() => {
    secretService.getStats()
      .then(s => setUnreadCount(s.unreadCount))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  return { unreadCount, refresh }
}