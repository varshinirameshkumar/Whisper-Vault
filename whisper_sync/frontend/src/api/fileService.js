import api from './axiosConfig'

export const fileService = {
  /**
   * Upload AES-256-GCM encrypted file bytes via REST multipart.
   * Returns { token, fileName, mimeType, fileSize }
   */
  async upload(roomId, encryptedBlob, iv, fileName, mimeType, fileSize, messageType) {
    const form = new FormData()
    form.append('file', encryptedBlob, fileName)
    form.append('iv', iv)
    form.append('fileName', fileName)
    form.append('mimeType', mimeType || 'application/octet-stream')
    form.append('fileSize', String(fileSize))
    form.append('messageType', messageType)
    const res = await api.post(`/files/upload/${roomId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60s for large files
    })
    return res.data.data  // { token, fileName, mimeType, fileSize }
  },

  /**
   * Download encrypted file bytes by token.
   * Returns { encryptedBytes (ArrayBuffer), iv, fileName, mimeType, fileSize, messageType }
   */
  async download(token) {
    const res = await api.get(`/files/${token}`, {
      responseType: 'arraybuffer',
      timeout: 60000,
    })
    return {
      encryptedBytes: res.data,
      iv:          res.headers['x-file-iv'],
      fileName:    res.headers['x-file-name'],
      mimeType:    res.headers['x-file-mimetype'],
      fileSize:    Number(res.headers['x-file-size'] || 0),
      messageType: res.headers['x-message-type'],
    }
  },
}
