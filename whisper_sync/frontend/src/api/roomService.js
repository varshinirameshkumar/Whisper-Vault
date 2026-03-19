import api from './axiosConfig'

export const roomService = {
  async createRoom(invitedUsernames) {
    const res = await api.post('/rooms', { invitedUsernames })
    return res.data.data
  },

  async listMyRooms() {
    const res = await api.get('/rooms')
    return res.data.data
  },

  async getRoom(roomId) {
    const res = await api.get(`/rooms/${roomId}`)
    return res.data.data
  },

  async joinRoom(roomId) {
    const res = await api.post(`/rooms/${roomId}/join`)
    return res.data.data
  },

  async burnRoom(roomId) {
    const res = await api.post(`/rooms/${roomId}/burn`)
    return res.data.data
  },
}

export const publicRoomService = {
  async createPublicRoom() {
    const res = await (await import('./axiosConfig')).default.post('/rooms/public')
    return res.data.data
  },
  async listPublicRooms() {
    const res = await (await import('./axiosConfig')).default.get('/rooms/public')
    return res.data.data
  },
  async spectate(roomId) {
    const res = await (await import('./axiosConfig')).default.post(`/rooms/${roomId}/spectate`)
    return res.data.data
  },
  async knock(roomId) {
    const res = await (await import('./axiosConfig')).default.post(`/rooms/${roomId}/knock`)
    return res.data.data
  },
  async acceptKnock(roomId, username) {
    const res = await (await import('./axiosConfig')).default.post(`/rooms/${roomId}/accept-knock/${username}`)
    return res.data.data
  },
}
