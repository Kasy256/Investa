import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import "../styles/contribution-history.css"
import { formatMoney } from "../utils/currency"
import { fetchUserContributions } from "../api/contributions"

const ContributionHistory = ({ user }) => {
  const [contributions, setContributions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const list = await fetchUserContributions()
        if (!isMounted) return
        setContributions(list)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "completed"
      case "pending":
        return "pending"
      case "failed":
        return "failed"
      default:
        return ""
    }
  }

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case "card":
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        )
      case "wallet":
        return (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        )
      default:
        return null
    }
  }

  const filteredContributions = contributions.filter((contrib) => {
    if (filter === "all") return true
    return contrib.status === filter
  })

  const totalContributed = contributions
    .filter((contrib) => contrib.status === "completed")
    .reduce((sum, contrib) => sum + contrib.amount, 0)

  const pendingAmount = contributions
    .filter((contrib) => contrib.status === "pending")
    .reduce((sum, contrib) => sum + contrib.amount, 0)

  if (loading) {
    return (
      <div className="contribution-history-container">
        <div className="contribution-history-loading">
          <div className="contribution-history-loading-content">
            <div className="contribution-history-loading-spinner"></div>
            <p className="contribution-history-loading-text">Loading contribution history...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="contribution-history-container">
      {/* Header */}
      <div className="contribution-history-header">
        <div className="contribution-history-header-info">
          <h1>Contribution History</h1>
          <p>Track all your investment contributions</p>
        </div>
        <Link to="/dashboard" className="contribution-history-back-btn">
          Back to Dashboard
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="contribution-history-stats">
        <div className="contribution-history-stat-card">
          <div className="contribution-history-stat-value">{formatMoney(totalContributed)}</div>
          <div className="contribution-history-stat-label">Total Contributed</div>
        </div>
        <div className="contribution-history-stat-card">
          <div className="contribution-history-stat-value">{formatMoney(pendingAmount)}</div>
          <div className="contribution-history-stat-label">Pending Amount</div>
        </div>
        <div className="contribution-history-stat-card">
          <div className="contribution-history-stat-value">
            {contributions.filter((c) => c.status === "completed").length}
          </div>
          <div className="contribution-history-stat-label">Successful Payments</div>
        </div>
        <div className="contribution-history-stat-card">
          <div className="contribution-history-stat-value">{new Set(contributions.map((c) => c.roomId)).size}</div>
          <div className="contribution-history-stat-label">Rooms Contributed</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="contribution-history-filters">
        <div className="contribution-history-filter-tabs">
          {[
            { key: "all", label: "All Contributions" },
            { key: "completed", label: "Completed" },
            { key: "pending", label: "Pending" },
            { key: "failed", label: "Failed" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`contribution-history-filter-tab ${filter === tab.key ? "active" : ""}`}
            >
              {tab.label}
              <span className="contribution-history-filter-count">
                ({tab.key === "all" ? contributions.length : contributions.filter((c) => c.status === tab.key).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Contributions List */}
      <div className="contribution-history-table-card">
        {filteredContributions.length === 0 ? (
          <div className="contribution-history-empty">
            <div className="contribution-history-empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </div>
            <h3>No Contributions Found</h3>
            <p>{filter === "all" ? "You haven't made any contributions yet." : `No ${filter} contributions found.`}</p>
            <Link to="/dashboard" className="contribution-history-empty-btn">
              Start Contributing
            </Link>
          </div>
        ) : (
          <div className="contribution-history-table-wrapper">
            <table className="contribution-history-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment Method</th>
                  <th>Date</th>
                  <th>Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredContributions.map((contribution) => (
                  <tr key={contribution.id}>
                    <td>
                      <div>
                        <Link to={`/room/${contribution.roomId}`} className="contribution-history-room-link">
                          {contribution.roomName}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <span className="contribution-history-amount">{formatMoney(contribution.amount)}</span>
                    </td>
                    <td>
                      <span className={`contribution-history-status-badge ${getStatusColor(contribution.status)}`}>
                        {contribution.status.charAt(0).toUpperCase() + contribution.status.slice(1)}
                      </span>
                      {contribution.status === "failed" && contribution.failureReason && (
                        <div className="contribution-history-failure-reason">{contribution.failureReason}</div>
                      )}
                    </td>
                    <td>
                      <div className="contribution-history-payment-method">
                        {getPaymentMethodIcon(contribution.paymentMethod)}
                        <span className="contribution-history-payment-text">
                          {contribution.paymentMethod === "card" ? "Credit Card" : "Wallet Transfer"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="contribution-history-date">
                        {new Date(contribution.createdAt).toLocaleDateString()}
                      </div>
                      <div className="contribution-history-time">
                        {new Date(contribution.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td>
                      <span className="contribution-history-transaction-id">{contribution.transactionId}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContributionHistory
