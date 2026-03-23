import api from './axiosConfig'

export const roomService = {
  async createRoom(invitedUsernames, groupName) {
    const res = await api.post('/rooms', { invitedUsernames, groupName })
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
  async addParticipant(roomId, username) {
    const res = await api.post(`/rooms/${roomId}/add-participant`, { username })
    return res.data.data
  },
}

export const publicRoomService = {
  async createPublicRoom(groupName) {
    const res = await api.post('/rooms/public', { groupName })
    return res.data.data
  },
  async listPublicRooms() {
    const res = await api.get('/rooms/public')
    return res.data.data
  },
  async spectate(roomId) {
    const res = await api.post(`/rooms/${roomId}/spectate`)
    return res.data.data
  },
  async knock(roomId) {
    const res = await api.post(`/rooms/${roomId}/knock`)
    return res.data.data
  },
  async acceptKnock(roomId, username) {
    const res = await api.post(`/rooms/${roomId}/accept-knock/${username}`)
    return res.data.data
  },
}
