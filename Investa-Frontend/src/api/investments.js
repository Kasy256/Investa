import { get, post } from "./client"

export function castVote({ roomId, recommendationId, vote }) {
  return post("/investments/votes", {
    room_id: roomId,
    recommendation_id: recommendationId,
    vote,
  }).then((res) => res?.vote || res)
}

export function fetchVoteAggregate(roomId, recommendationId) {
  const params = new URLSearchParams()
  params.set("room_id", roomId)
  if (recommendationId) params.set("recommendation_id", recommendationId)
  return get(`/investments/votes/aggregate?${params.toString()}`).then((res) => res?.aggregate || res)
}

export function executeInvestment(roomId, allocations) {
  return post("/investments/execute", { room_id: roomId, allocations })
}

export function fetchRoomInvestmentAnalytics(roomId) {
  return get(`/investments/analytics?room_id=${encodeURIComponent(roomId)}`).then((res) => res?.analytics || res)
}

export function voteStopInvestment(roomId, recommendationId, assetName) {
  return post("/investments/stop", { room_id: roomId, recommendation_id: recommendationId, asset_name: assetName })
}

export function fetchStopVoteAggregate(roomId, recommendationId) {
  const params = new URLSearchParams()
  params.set("room_id", roomId)
  if (recommendationId) params.set("recommendation_id", recommendationId)
  return get(`/investments/stop/aggregate?${params.toString()}`).then((res) => res?.aggregate || res)
}

export function endInvestment(roomId) {
  return post("/investments/end", { room_id: roomId })
}


