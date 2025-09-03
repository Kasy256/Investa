import { get, put } from "./client"

function normalizeUser(u) {
  if (!u) return null
  return {
    id: u.id || u._id,
    displayName: u.display_name || u.displayName,
    email: u.email,
    riskPreference: u.risk_preference || u.riskPreference,
    createdAt: u.created_at || u.createdAt,
    updatedAt: u.updated_at || u.updatedAt,
  }
}

function normalizeUserStats(s) {
  if (!s) return null
  return {
    investmentRooms: s.investment_rooms || s.investmentRooms || 0,
    totalInvested: s.total_invested || s.totalInvested || 0,
    totalReturns: s.total_returns || s.totalReturns || 0,
    activeRooms: s.active_rooms || s.activeRooms || 0,
    completedRooms: s.completed_rooms || s.completedRooms || 0,
  }
}

export function fetchUserProfile() {
  return get("/users/profile").then((res) => normalizeUser(res?.user || res))
}

export function updateUserProfile(profileData) {
  return put("/users/profile", {
    display_name: profileData.displayName,
    risk_preference: profileData.riskPreference,
  }).then((res) => normalizeUser(res?.user || res))
}

export function fetchUserStats() {
  return get("/users/stats").then((res) => normalizeUserStats(res?.stats || res))
}
