import { useState, useEffect } from 'react'

export function useTabBlur() {
  const [isBlurred, setIsBlurred] = useState(false)

  useEffect(() => {
    const onBlur  = () => setIsBlurred(true)
    const onFocus = () => setIsBlurred(false)
    window.addEventListener('blur',  onBlur)
    window.addEventListener('focus', onFocus)
    // Also handle Page Visibility API for mobile
    const onVisibility = () => setIsBlurred(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur',  onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return isBlurred
}