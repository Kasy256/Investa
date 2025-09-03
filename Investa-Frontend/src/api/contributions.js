import { get, post } from "./client"

function normalizeContribution(c) {
  if (!c) return null
  return {
    id: c.id || c._id,
    roomId: c.room_id,
    roomName: c.room_name || c.room?.name,
    amount: c.amount,
    status: c.status,
    paymentMethod: c.payment_method,
    transactionId: c.transaction_id,
    createdAt: c.created_at,
    completedAt: c.completed_at,
    failureReason: c.failure_reason,
  }
}

function normalizeContributions(arr) {
  return (arr || []).map(normalizeContribution).filter(Boolean)
}

export function createContribution({ roomId, amount }) {
  return post("/contributions", { room_id: roomId, amount }).then((res) => normalizeContribution(res?.contribution || res))
}

export function fetchUserContributions({ status, limit = 50, skip = 0 } = {}) {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("skip", String(skip))
  if (status) params.set("status", status)
  return get(`/contributions?${params.toString()}`).then((res) => normalizeContributions(res?.contributions || res))
}

export function fetchRoomContributions(roomId, { limit = 50, skip = 0 } = {}) {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("skip", String(skip))
  params.set("room_id", roomId)
  return get(`/contributions?${params.toString()}`).then((res) => normalizeContributions(res?.contributions || res))
}


