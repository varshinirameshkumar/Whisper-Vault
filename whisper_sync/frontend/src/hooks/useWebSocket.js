import { useEffect, useRef, useCallback, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8080'

export function useWebSocket({ roomId, onMessage, onHistory, onSystemEvent, enabled = true }) {
  const clientRef             = useRef(null)
  const onMessageRef          = useRef(onMessage)
  const onHistoryRef          = useRef(onHistory)
  const onSystemEventRef      = useRef(onSystemEvent)
  const [connected, setConnected]   = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Keep callback refs fresh without re-triggering connect effect
  useEffect(() => { onMessageRef.current     = onMessage     }, [onMessage])
  useEffect(() => { onHistoryRef.current     = onHistory     }, [onHistory])
  useEffect(() => { onSystemEventRef.current = onSystemEvent }, [onSystemEvent])

  const token = localStorage.getItem('wv_token')

  useEffect(() => {
    if (!enabled || !roomId || !token) return

    setConnecting(true)

    const client = new Client({
      // Use a factory so SockJS is created fresh on each (re)connect
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,

      onConnect: () => {
        setConnected(true)
        setConnecting(false)
        console.log('[WS] Connected to room', roomId)

        // Broadcast channel — all room messages
        client.subscribe(`/topic/chat/${roomId}`, (frame) => {
          try {
            const msg = JSON.parse(frame.body)
            const systemTypes = ['JOIN', 'LEAVE', 'SYSTEM', 'ROOM_BURNED', 'KNOCK_REQUEST', 'KNOCK_ACCEPTED']
            if (systemTypes.includes(msg.type)) {
              onSystemEventRef.current?.(msg)
            } else {
              onMessageRef.current?.(msg)
            }
          } catch (e) {
            console.warn('[WS] Malformed frame', e)
          }
        })

        // Personal history channel
        client.subscribe(`/user/queue/history/${roomId}`, (frame) => {
          try {
            const payload = JSON.parse(frame.body)
            if (payload.type === 'HISTORY') onHistoryRef.current?.(payload.messages || [])
          } catch (e) {
            console.warn('[WS] Bad history frame', e)
          }
        })
      },

      onDisconnect: () => {
        console.log('[WS] Disconnected')
        setConnected(false)
        setConnecting(false)
      },

      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame.headers?.message, frame.body)
        setConnected(false)
        setConnecting(false)
      },

      onWebSocketError: (error) => {
        console.error('[WS] WebSocket error:', error)
        setConnected(false)
        setConnecting(false)
      },
    })

    clientRef.current = client
    client.activate()

    return () => {
      console.log('[WS] Cleaning up for room', roomId)
      client.deactivate()
      clientRef.current = null
      setConnected(false)
      setConnecting(false)
    }
  }, [roomId, token, enabled]) // stable deps only — callbacks handled via refs

  const sendMessage = useCallback((payload) => {
    const c = clientRef.current
    if (!c?.connected) {
      console.warn('[WS] sendMessage called but not connected')
      return false
    }
    c.publish({
      destination: `/app/chat/${roomId}`,
      body: JSON.stringify(payload),
    })
    return true
  }, [roomId])

  const disconnect = useCallback(() => {
    clientRef.current?.deactivate()
    clientRef.current = null
    setConnected(false)
    setConnecting(false)
  }, [])

  return { connected, connecting, sendMessage, disconnect }
}
