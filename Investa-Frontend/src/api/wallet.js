import { get, post } from "./client"

function normalizeWallet(w) {
  if (!w) return null
  return {
    id: w.id || w._id,
    balance: w.balance,
    totalDeposited: w.total_deposited,
    totalWithdrawn: w.total_withdrawn,
    totalReturns: w.total_returns,
    currency: w.currency || "KES",
    lastUpdated: w.updated_at || w.last_updated,
  }
}

function normalizeTransaction(t) {
  if (!t) return null
  return {
    id: t.id || t._id,
    type: t.type, // deposit, withdrawal, contribution, return, refund
    amount: t.amount,
    roomId: t.room_id,
    roomName: t.room_name || t.room?.name,
    status: t.status,
    date: t.created_at || t.transaction_date,
    reference: t.reference,
    description: t.description,
  }
}

export function fetchWallet() {
  return get("/wallet/balance").then((res) => normalizeWallet(res?.wallet || res))
}

export function fetchWalletTransactions({ type, limit = 50, skip = 0 } = {}) {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("skip", String(skip))
  if (type && type !== "all") params.set("type", type)
  return get(`/wallet/transactions?${params.toString()}`).then((res) => {
    const list = res?.transactions || res
    return (list || []).map(normalizeTransaction).filter(Boolean)
  })
}

export function topup(amount) {
  return post("/wallet/topup", { amount }).then((res) => res?.transaction || res)
}

export function requestWithdrawal(amount, reason) {
  return post("/wallet/withdraw", { amount, reason }).then((res) => res?.withdrawal || res)
}


