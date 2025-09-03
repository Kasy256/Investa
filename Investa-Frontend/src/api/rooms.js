import { get, post, del } from "./client"

function normalizeRoom(apiRoom) {
  if (!apiRoom) return null
  return {
    id: apiRoom.id || apiRoom._id || apiRoom.room_id || apiRoom.roomId,
    name: apiRoom.name,
    description: apiRoom.description,
    goal: apiRoom.goal_amount,
    collected: apiRoom.collected_amount,
    maxMembers: apiRoom.max_members,
    members: apiRoom.current_members,
    riskLevel: apiRoom.risk_level,
    type: apiRoom.investment_type,
    status: apiRoom.status,
    visibility: apiRoom.visibility,
    roomCode: apiRoom.room_code,
    creatorId: apiRoom.creator_id,
    createdAt: apiRoom.created_at,
    updatedAt: apiRoom.updated_at,
    isCreator: Boolean(apiRoom.is_current_user_creator),
    hasExecution: Boolean(apiRoom.has_execution) || apiRoom.status === 'investing',
  }
}

function normalizeRooms(arr) {
  return (arr || []).map(normalizeRoom).filter(Boolean)
}

function normalizeMember(m) {
  if (!m) return null
  return {
    id: m.id || m._id,
    roomId: m.room_id,
    userId: m.user_id,
    name: m.name || m.display_name || m.user_name, // may be undefined
    email: m.email,
    contribution: m.contribution_amount,
    isCreator: m.is_creator,
    joinedAt: m.joined_at,
    status: m.status,
  }
}

function normalizeMembers(arr) {
  return (arr || []).map(normalizeMember).filter(Boolean)
}

export function fetchUserRooms() {
  return get("/rooms?type=user").then((res) => normalizeRooms(Array.isArray(res) ? res : res?.rooms))
}

export function fetchPublicRooms() {
  return get("/rooms?type=public").then((res) => normalizeRooms(Array.isArray(res) ? res : res?.rooms))
}

export function createRoom(payload) {
  const body = {
    name: payload.name,
    description: payload.description || "",
    goal_amount: payload.goal,
    max_members: payload.maxMembers,
    risk_level: payload.riskLevel,
    investment_type: payload.type,
    visibility: payload.visibility || "public",
  }
  return post("/rooms", body).then((res) => normalizeRoom(res?.room || res))
}

export function joinRoom(roomId) {
  return post(`/rooms/${roomId}/join`)
}

export function fetchRoom(roomId) {
  return get(`/rooms/${roomId}`).then((res) => {
    const normalized = normalizeRoom(res?.room || res)
    return normalized
  })
}

export function fetchRoomMembers(roomId) {
  return get(`/rooms/${roomId}/members`).then((res) => normalizeMembers(res?.members || res))
}

export function leaveRoom(roomId) {
  return post(`/rooms/${roomId}/leave`)
}

export function deleteRoom(roomId) {
  return del(`/rooms/${roomId}`)
}


