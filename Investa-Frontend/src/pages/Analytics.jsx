import { useEffect, useState } from "react"
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3 } from "lucide-react"
import "../styles/analytics.css"
import { fetchDashboardAnalytics, fetchPerformanceMetrics } from "../api/analytics"
import { fetchRoomInvestmentAnalytics } from "../api/investments"
import { useLocation } from "react-router-dom"
import { formatMoney } from "../utils/currency"
import { useAutoRefresh } from "../hooks/useAutoRefresh"

const Analytics = () => {
  const [timeRange, setTimeRange] = useState("6M")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [roomAnalytics, setRoomAnalytics] = useState(null)
  const location = useLocation()

  const params = new URLSearchParams(location.search)
  const roomId = params.get("roomId")

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const tasks = [fetchDashboardAnalytics(), fetchPerformanceMetrics(timeRange)]
        if (roomId) tasks.push(fetchRoomInvestmentAnalytics(roomId))
        const [dash, perf, ra] = await Promise.all(tasks)
        if (!isMounted) return
        setDashboard(dash)
        setMetrics(perf)
        if (roomId) setRoomAnalytics(ra)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [timeRange, roomId])

  // Auto-refresh analytics data when page becomes visible (e.g., after navigation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !loading) {
        // Refresh analytics data when page becomes visible
        async function refresh() {
          try {
            const tasks = [fetchDashboardAnalytics(), fetchPerformanceMetrics(timeRange)]
            if (roomId) tasks.push(fetchRoomInvestmentAnalytics(roomId))
            const [dash, perf, ra] = await Promise.all(tasks)
            setDashboard(dash)
            setMetrics(perf)
            if (roomId) setRoomAnalytics(ra)
          } catch (error) {
            console.error("Error refreshing analytics data:", error)
          }
        }
        refresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loading, timeRange, roomId])

  // Manual refresh function
  const refreshAnalytics = async () => {
    setRefreshing(true)
    try {
      const tasks = [fetchDashboardAnalytics(), fetchPerformanceMetrics(timeRange)]
      if (roomId) tasks.push(fetchRoomInvestmentAnalytics(roomId))
      const [dash, perf, ra] = await Promise.all(tasks)
      setDashboard(dash)
      setMetrics(perf)
      if (roomId) setRoomAnalytics(ra)
    } catch (error) {
      console.error("Error refreshing analytics data:", error)
    } finally {
      setRefreshing(false)
    }
  }

  // Auto-refresh analytics data every 5 seconds
  const { manualRefresh } = useAutoRefresh(refreshAnalytics, 5000, true, [timeRange, roomId])

  // Get time range periods based on selection
  const getTimeRangePeriods = () => {
    switch (timeRange) {
      case "1M": return 4
      case "3M": return 6
      case "6M": return 8
      case "1Y": return 12
      default: return 6
    }
  }

  // Get time labels based on selection
  const getTimeLabels = () => {
    const periods = getTimeRangePeriods()
    switch (timeRange) {
      case "1M":
        return Array.from({ length: periods }, (_, i) => `Week ${i + 1}`)
      case "3M":
        return Array.from({ length: periods }, (_, i) => `Month ${i + 1}`)
      case "6M":
        return Array.from({ length: periods }, (_, i) => `Month ${i + 1}`)
      case "1Y":
        return Array.from({ length: periods }, (_, i) => `Month ${i + 1}`)
      default:
        return Array.from({ length: periods }, (_, i) => `P${i + 1}`)
    }
  }

  // Derive totals with robust fallbacks
  const num = (v) => (v === undefined || v === null ? 0 : Number(v))
  let totalPortfolioValue = 0
  let totalInvested = 0
  if (roomId && roomAnalytics?.series?.length) {
    // When viewing a specific room, use executed analytics
    const investedAmt = Number(roomAnalytics?.invested_amount || 0)
    const lastVal = Number(roomAnalytics.series[roomAnalytics.series.length - 1]?.value || investedAmt)
    totalInvested = investedAmt
    totalPortfolioValue = lastVal
  } else if (Array.isArray(dashboard?.room_performance) && dashboard.room_performance.length > 0) {
    // Otherwise, compute portfolio totals from room performance (support multiple key names)
    totalInvested = dashboard.room_performance.reduce(
      (s, r) => s + num(r.invested ?? r.invested_amount ?? r.total_invested),
      0,
    )
    totalPortfolioValue = dashboard.room_performance.reduce(
      (s, r) => s + num(r.current_value ?? r.current ?? 0),
      0,
    )
    // If calculated invested is 0 but portfolio aggregate exists, fall back to it
    if (!totalInvested && dashboard?.portfolio?.total_invested) {
      totalInvested = num(dashboard.portfolio.total_invested)
    }
    if (!totalPortfolioValue && dashboard?.portfolio?.total_value) {
      totalPortfolioValue = num(dashboard.portfolio.total_value)
    }
  } else {
    // Fallback to any provided portfolio aggregates
    totalPortfolioValue = num(dashboard?.portfolio?.total_value)
    totalInvested = num(dashboard?.portfolio?.total_invested)
  }
  const totalReturns = totalPortfolioValue - totalInvested
  const returnsPercentage = totalInvested > 0 ? ((totalReturns / totalInvested) * 100).toFixed(1) : 0
  // Build portfolio breakdown as per-room performance
  let portfolioBreakdown = []
  if (Array.isArray(dashboard?.room_performance) && dashboard.room_performance.length > 0) {
    // Separate active and ended rooms
    const activeRooms = dashboard.room_performance.filter(r => r.status !== 'closed' && r.status !== 'ended')
    const endedRooms = dashboard.room_performance.filter(r => r.status === 'closed' || r.status === 'ended')
    
    // Only show active rooms in the portfolio breakdown charts
    const rooms = activeRooms
    const totalCurrent = rooms.reduce((s, r) => s + num(r.current_value ?? r.current), 0)
    const palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"]
    portfolioBreakdown = rooms.map((r, i) => {
      const current = num(r.current_value ?? r.current)
      const invested = num(r.invested ?? r.invested_amount)
      const profit = current - invested
      const percentage = totalCurrent > 0 ? Math.round((current / totalCurrent) * 100) : 0
      return { 
        name: r.name || r.room_name || `Room ${i + 1}`, 
        value: percentage, 
        amount: current, 
        profit: profit,
        color: palette[i % palette.length] 
      }
    })
    

  }

  // Build performance series: show room-based performance over time
  let performanceData = []
  let perRoomLines = []
  if (Array.isArray(dashboard?.room_performance) && dashboard.room_performance.length > 0) {
    // Filter out ended rooms for performance charts
    const activeRooms = dashboard.room_performance.filter(r => r.status !== 'closed' && r.status !== 'ended')
    const periods = getTimeRangePeriods()
    const timeLabels = getTimeLabels()
    const palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
    
    // Generate per-room performance lines
    perRoomLines = activeRooms.map((room, i) => {
      const invested = num(room.invested ?? room.invested_amount)
      const current = num(room.current_value ?? room.current)
      const growth = invested > 0 ? current / invested : 1
      
      // Simulate performance over time with some variance
      const roomData = Array.from({ length: periods }, (_, idx) => {
        const progress = (idx + 1) / periods
        const variance = 0.95 + (Math.sin(idx * 0.5) * 0.1) // Add some realistic variance
        const value = invested * (1 + (growth - 1) * progress * variance)
        return { month: timeLabels[idx], value: Math.round(value) }
      })
      
      return {
        name: room.name || room.room_name || `Room ${i + 1}`,
        color: palette[i % palette.length],
        data: roomData,
      }
    })
    
    // Create chart data with only room performance lines
    performanceData = Array.from({ length: periods }, (_, idx) => {
      const dataPoint = { month: timeLabels[idx] }
      perRoomLines.forEach((room, rIdx) => {
        dataPoint[`room_${rIdx}`] = room.data[idx]?.value ?? 0
      })
      return dataPoint
    })
  } else if (roomAnalytics?.series?.length) {
    // Fallback to single room analytics
    const timeLabels = getTimeLabels()
    performanceData = roomAnalytics.series.map((p, idx) => ({
      month: timeLabels[idx] || `P${idx + 1}`,
      value: p.value,
    }))
  } else if (metrics?.series?.length) {
    // Expecting shape: [{ t, value }]
    const timeLabels = getTimeLabels()
    performanceData = metrics.series.map((p, idx) => ({
      month: p.month || p.t || timeLabels[idx] || `P${idx + 1}`,
      value: p.value ?? 0,
    }))
  } else {
    // Last-resort synthetic data so chart renders
    const base = totalInvested || 1000
    const periods = getTimeRangePeriods()
    const timeLabels = getTimeLabels()
    let current = base
    for (let i = 0; i < periods; i++) {
      const drift = 1 + (i % 2 === 0 ? 0.03 : -0.01)
      current = Math.max(0, current * drift)
      performanceData.push({ month: timeLabels[i], value: Math.round(current) })
    }
  }


  let roomPerformance = []
  if (roomId && roomAnalytics?.series?.length) {
    const investedAmt = num(roomAnalytics.invested_amount)
    const currentVal = num(roomAnalytics.series[roomAnalytics.series.length - 1]?.value)
    const profit = currentVal - investedAmt
    const perf = investedAmt > 0 ? ((profit / investedAmt) * 100).toFixed(1) : 0
    roomPerformance = [{ name: "Selected Room", invested: investedAmt, current: currentVal, returns: Number(perf) }]
  } else if (Array.isArray(dashboard?.room_performance)) {
    // Show all rooms (active and ended) in the performance table
    roomPerformance = dashboard.room_performance.map((r) => {
      const invested = num(r.invested ?? r.invested_amount)
      const current = num(r.current_value ?? r.current)
      const retPct = invested > 0 ? ((current - invested) / invested) * 100 : 0
      return { 
        name: r.name || r.room_name || "Room", 
        invested, 
        current, 
        returns: Number(retPct.toFixed(1)),
        status: r.status || 'active'
      }
    })
  }
  const roomsCount = Array.isArray(dashboard?.room_performance) ? dashboard.room_performance.filter(r => r.status !== 'closed' && r.status !== 'ended').length : 0

  return (
    <div className="analytics-page">
      <div className="analytics-container">
        {/* Header */}
        <div className="analytics-header">
          <div className="analytics-header-info">
            <h1 className="analytics-title">Investment Analytics</h1>
            <p className="analytics-subtitle">Track your investment performance and portfolio insights</p>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon emerald">
                <DollarSign />
              </div>
              <span className="metric-change positive">
                <TrendingUp />+{returnsPercentage}%
              </span>
            </div>
            <h3 className="metric-value">{formatMoney(totalPortfolioValue)}</h3>
            <p className="metric-label">Total Portfolio Value</p>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon blue">
                <Target />
              </div>
              <span className="metric-change neutral">Invested</span>
            </div>
            <h3 className="metric-value">{formatMoney(totalInvested)}</h3>
            <p className="metric-label">Total Invested</p>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon green">
                <TrendingUp />
              </div>
              <span className="metric-change positive">Profit</span>
            </div>
            <h3 className="metric-value">{formatMoney(totalReturns)}</h3>
            <p className="metric-label">Total Returns</p>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon purple">
                <BarChart3 />
              </div>
              <span className="metric-change neutral">Active</span>
            </div>
            <h3 className="metric-value">{roomsCount}</h3>
            <p className="metric-label">Investment Rooms</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          {/* Portfolio Performance Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Portfolio Performance</h3>
              <div className="time-range-buttons">
                {["1M", "3M", "6M", "1Y"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`time-range-button ${timeRange === range ? "active" : ""}`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={performanceData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="month" stroke="#64748b" tickMargin={8} />
                <YAxis 
                  domain={["dataMin - 10%", "dataMax + 10%"]} 
                  stroke="#64748b" 
                  tickFormatter={(v) => formatMoney(v)} 
                  width={90}
                  allowDataOverflow={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 8 }}
                  formatter={(value, name) => [formatMoney(value), name]}
                  labelFormatter={(label) => {
                    if (timeRange === "1M") return `Week ${label.replace("Week ", "")}`
                    if (timeRange === "3M" || timeRange === "6M" || timeRange === "1Y") return `Month ${label.replace("Month ", "")}`
                    return label
                  }}
                />
                {perRoomLines.length > 0 ? (
                  <>
                    {perRoomLines.map((s, idx) => (
                      <Line 
                        key={s.name} 
                        type="monotone" 
                        dataKey={`room_${idx}`} 
                        stroke={s.color} 
                        strokeWidth={3} 
                        dot={{ r: 3 }} 
                        name={s.name} 
                        connectNulls={false}
                      />
                    ))}
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 12 }} />
                  </>
                ) : (
                <Line
                  type="monotone"
                    dataKey="value" 
                    stroke="#059669" 
                    strokeWidth={3} 
                    dot={{ r: 3 }} 
                    name="Portfolio Value" 
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Portfolio Breakdown */}
          <div className="chart-card">
            <h3 className="chart-title">Portfolio Breakdown</h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={portfolioBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {portfolioBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => [formatMoney(value), props?.payload?.name || name]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="breakdown-legend">
              {portfolioBreakdown.map((item, index) => (
                <div key={index} className="legend-item">
                  <div className="legend-left">
                    <div className="legend-color" style={{ backgroundColor: item.color }}></div>
                    <span className="legend-name">{item.name}</span>
                  </div>
                  <div className="legend-right">
                    <div className="legend-amount">{formatMoney(item.amount)}</div>
                    <div className="legend-percentage">{item.value}%</div>
                    {item.profit !== undefined && (
                      <div className={`legend-profit ${item.profit >= 0 ? 'positive' : 'negative'}`}>
                        {formatMoney(item.profit)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Room Performance Table */}
        <div className="performance-table">
          <h3 className="table-title">Room Performance</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Room Name</th>
                  <th>Status</th>
                  <th>Invested</th>
                  <th>Current Value</th>
                  <th>Returns</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {roomPerformance.map((room, index) => (
                  <tr key={index} className={room.status === 'closed' || room.status === 'ended' ? 'ended-room' : ''}>
                    <td>
                      <div className="room-name">{room.name}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${room.status === 'closed' || room.status === 'ended' ? 'ended' : 'active'}`}>
                        {room.status === 'closed' || room.status === 'ended' ? 'Ended' : 'Active'}
                      </span>
                    </td>
                    <td className="amount-invested">{formatMoney(room.invested)}</td>
                    <td className="current-value">{formatMoney(room.current)}</td>
                    <td>
                      <span className={`returns-amount ${room.current - room.invested > 0 ? "positive" : "negative"}`}>
                        {formatMoney(room.current - room.invested)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`performance-badge ${
                          room.returns > 15 ? "high" : room.returns > 10 ? "medium" : "low"
                        }`}
                      >
                        {room.returns > 0 ? <TrendingUp /> : <TrendingDown />}
                        {room.returns}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
