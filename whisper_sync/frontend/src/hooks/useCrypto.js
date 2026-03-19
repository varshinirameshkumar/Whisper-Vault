import { useCallback, useRef } from 'react'

/** Safe ArrayBuffer → Base64 — chunked to avoid spread stack overflow on large buffers */
function bufToB64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** Base64 → Uint8Array */
function b64ToBuf(b64) {
  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function useCrypto(roomId) {
  const keyRef = useRef(null)

  const getKey = useCallback(async () => {
    if (keyRef.current) return keyRef.current
    const enc    = new TextEncoder()
    const keyMat = await crypto.subtle.importKey(
      'raw', enc.encode(roomId + '-whisper-vault-aes-256'),
      { name: 'PBKDF2' }, false, ['deriveKey']
    )
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('whispervault-salt'), iterations: 100000, hash: 'SHA-256' },
      keyMat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    )
    keyRef.current = key
    return key
  }, [roomId])

  /** Encrypt a plain string → { encryptedPayload, iv } */
  const encrypt = useCallback(async (plaintext) => {
    const key    = await getKey()
    const iv     = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
    )
    return {
      encryptedPayload: bufToB64(cipher),
      iv: bufToB64(iv.buffer),
    }
  }, [getKey])

  /** Decrypt { encryptedPayload, iv } → plain string */
  const decrypt = useCallback(async (encryptedPayload, ivB64) => {
    try {
      const key   = await getKey()
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBuf(ivB64) },
        key, b64ToBuf(encryptedPayload)
      )
      return new TextDecoder().decode(plain)
    } catch (e) {
      console.warn('[useCrypto] decrypt failed', e)
      return '[decryption failed]'
    }
  }, [getKey])

  /**
   * Encrypt a File/Blob → { encryptedPayload, iv, fileName, mimeType, fileSize }
   * Uses chunked Base64 — safe for any file size up to 5 MB.
   */
  const encryptFile = useCallback(async (file) => {
    const key    = await getKey()
    const iv     = crypto.getRandomValues(new Uint8Array(12))
    const buffer = await file.arrayBuffer()
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer)
    return {
      encryptedPayload: bufToB64(cipher),
      iv:               bufToB64(iv.buffer),
      fileName:         file.name,
      mimeType:         file.type || 'application/octet-stream',
      fileSize:         file.size,
    }
  }, [getKey])

  /** Decrypt an encrypted file payload → Blob
   *  @param payload  Base64 string (legacy WS) OR ArrayBuffer (REST download)
   *  @param ivB64    Base64 IV string
   *  @param mimeType MIME type for the resulting Blob
   *  @param isRawBuffer  true when payload is an ArrayBuffer from REST download
   */
  const decryptFile = useCallback(async (payload, ivB64, mimeType, isRawBuffer = false) => {
    try {
      const key        = await getKey()
      const cipherBuf  = isRawBuffer ? payload : b64ToBuf(payload).buffer
      const plain      = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBuf(ivB64) },
        key, cipherBuf
      )
      return new Blob([plain], { type: mimeType || 'application/octet-stream' })
    } catch (e) {
      console.warn('[useCrypto] decryptFile failed', e)
      return null
    }
  }, [getKey])

  return { encrypt, decrypt, encryptFile, decryptFile }
}
