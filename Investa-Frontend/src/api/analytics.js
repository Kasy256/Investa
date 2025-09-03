// Analytics API helpers and demo generators
import { get } from "./client"

export function fetchDashboardAnalytics() {
  return get("/analytics/dashboard").then((res) => res?.dashboard || res)
}

export function fetchPerformanceMetrics(timeRange = "6M") {
  return get(`/analytics/performance?time_range=${encodeURIComponent(timeRange)}`).then((res) => res?.metrics || res)
}

// Demo recommendations generator for the investment page
// In production, replace with a real endpoint response

// Seeded RNG so all members in a room see identical recommendations
function createSeededRandom(seedString) {
  // xmur3 hash to 32-bit
  function xmur3(str) {
    let h = 1779033703 ^ str.length
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
      h = (h << 13) | (h >>> 19)
    }
    return function() {
      h = Math.imul(h ^ (h >>> 16), 2246822507)
      h = Math.imul(h ^ (h >>> 13), 3266489909)
      h ^= h >>> 16
      return h >>> 0
    }
  }
  // mulberry32 PRNG
  function mulberry32(a) {
    return function() {
      let t = (a += 0x6D2B79F5)
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const seedFn = xmur3(seedString || "investa-demo")
  return mulberry32(seedFn())
}

function randomIntFactory(rng) {
  return function(min, max) {
    return Math.floor(rng() * (max - min + 1)) + min
  }
}

function pickFactory(rng) {
  return function(array, n) {
    const copy = [...array]
    const out = []
    while (copy.length && out.length < n) {
      const idx = Math.floor(rng() * copy.length)
      out.push(copy.splice(idx, 1)[0])
    }
    return out
  }
}

export function fetchInvestmentRecommendations(room) {
  const seed = `${room?.id || room?.roomCode || room?.name || 'room'}|${room?.riskLevel || 'moderate'}|${room?.type || 'mixed'}`
  const rng = createSeededRandom(seed)
  const randomInt = randomIntFactory(rng)
  const pick = pickFactory(rng)
  const universe = {
    stocks: [
      { symbol: "EABL", name: "East African Breweries" },
      { symbol: "SCOM", name: "Safaricom" },
      { symbol: "KCB", name: "KCB Group" },
      { symbol: "EQTY", name: "Equity Group" },
      { symbol: "BATK", name: "BAT Kenya" },
    ],
    etfs: [
      { symbol: "GVT-ETF", name: "Govt Bonds ETF (Kenya)" },
      { symbol: "AFRI-ETF", name: "Africa Markets ETF" },
      { symbol: "KSH-INDEX", name: "Kenya 25 Index ETF" },
    ],
    bonds: [
      { symbol: "KSH-BOND-2Y", name: "Kenya T-Bond 2Y" },
      { symbol: "KSH-BOND-5Y", name: "Kenya T-Bond 5Y" },
      { symbol: "KSH-BOND-10Y", name: "Kenya T-Bond 10Y" },
    ],
    crypto: [
      { symbol: "BTC", name: "Bitcoin" },
      { symbol: "ETH", name: "Ethereum" },
      { symbol: "USDT", name: "Tether" },
    ],
  }

  const typeToPool = {
    stocks: ["stocks", "etfs"],
    etf: ["etfs", "stocks"],
    bonds: ["bonds", "etfs"],
    crypto: ["crypto", "etfs"],
    mixed: ["stocks", "etfs", "bonds", "crypto"],
  }

  const pools = typeToPool[room?.type || "mixed"] || typeToPool.mixed
  const poolItems = pools.flatMap((p) => universe[p])
  const count = Math.min(4, Math.max(2, Math.floor(poolItems.length / 2)))
  const picks = pick(poolItems, count)

  const riskMap = {
    conservative: ["low", "moderate"],
    moderate: ["moderate", "moderate-high"],
    aggressive: ["moderate-high", "high"],
  }
  const allowedRisks = riskMap[room?.riskLevel || "moderate"] || riskMap.moderate

  const total = Number(room?.collected || 0)
  // Deterministic allocation order per room
  const baseAllocations = [40, 30, 20, 10]
  const items = picks.map((p, idx) => {
    const type = pools.includes("bonds") && p.symbol.includes("BOND") ? "Bond" :
                 pools.includes("etfs") && p.symbol.includes("ETF") ? "ETF" :
                 pools.includes("crypto") && ["BTC", "ETH", "USDT"].includes(p.symbol) ? "Crypto" : "Stock"
    const allocation = baseAllocations[idx] || randomInt(10, 25)
    const riskLevel = allowedRisks[Math.min(idx, allowedRisks.length - 1)]
    const minInvestment = Math.max(1000, Math.round((total * allocation) / 100 / 10) * 10)
    const votesApprove = 0
    const votesReject = 0
    const votesPending = Math.max(0, room?.members || 0)
    return {
      id: `${p.symbol}-${idx}`,
      type,
      name: `${p.name} (${p.symbol})`,
      description: `Demo recommendation for ${p.name}.`,
      allocation,
      expectedReturn: type === 'Bond' ? '6-9%' : type === 'ETF' ? '8-12%' : type === 'Crypto' ? '15-35%' : '10-18%',
      riskLevel,
      minInvestment,
      fees: type === 'ETF' ? '0.15%' : '0% ',
      votes: { approve: votesApprove, reject: votesReject, pending: votesPending },
      details: type === 'ETF' ? { sector: 'Diversified', holdings: 25 } : type === 'Bond' ? { term: '2-5 years' } : { sector: 'Various' },
    }
  })

  return Promise.resolve(items)
}



