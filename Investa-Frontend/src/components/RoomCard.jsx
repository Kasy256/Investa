import { Link } from "react-router-dom"
import { formatMoney } from "../utils/currency"
import "../styles/room-card.css"

const RoomCard = ({ room, user, onJoin, hideDetails = false, hideContribute = false }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case "open":
        return "status-open"
      case "ready":
        return "status-ready"
      case "investing":
        return "status-investing"
      case "closed":
        return "status-closed"
      default:
        return ""
    }
  }

  const getRiskColor = (risk) => {
    switch (risk) {
      case "conservative":
        return "risk-conservative"
      case "moderate":
        return "risk-moderate"
      case "aggressive":
        return "risk-aggressive"
      default:
        return ""
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case "stocks":
        return "📈"
      case "crypto":
        return "₿"
      case "bonds":
        return "🏦"
      case "etf":
        return "📊"
      default:
        return "💼"
    }
  }

  const progressPercentage = room && room.goal ? (Number(room.collected || 0) / Number(room.goal || 1)) * 100 : 0
  const isTargetReached = progressPercentage >= 100

  return (
    <div className="room-card">
      {/* Header */}
      <div className="room-card-header">
        <div className="room-card-info">
          <div className="room-card-icon">{getTypeIcon(room.type)}</div>
          <div className="room-card-details">
            <h3>{room.name}</h3>
            <div className="room-card-badges">
              <span className={`room-card-badge ${getStatusColor(room.status)}`}>
                {(room.status || "").charAt(0).toUpperCase() + (room.status || "").slice(1)}
              </span>
              <span className={`room-card-badge ${getRiskColor(room.riskLevel)}`}>
                {(room.riskLevel || "").charAt(0).toUpperCase() + (room.riskLevel || "").slice(1)}
              </span>
            </div>
          </div>
        </div>
        {room.isCreator && <div className="room-card-creator-badge">Creator</div>}
      </div>

      {/* Progress */}
      <div className="room-card-progress">
        <div className="room-card-progress-header">
          <span className="room-card-progress-label">Progress</span>
          <span className="room-card-progress-amount">
            {formatMoney(room.collected)} / {formatMoney(room.goal)}
          </span>
        </div>
        <div className="room-card-progress-bar">
          <div
            className={`room-card-progress-fill ${isTargetReached ? "target-reached" : "in-progress"}`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          ></div>
        </div>
        <div className="room-card-progress-footer">
          <span className="room-card-progress-percentage">{Math.round(progressPercentage)}% complete</span>
          <span className="room-card-members-count">
            {room.members}/{room.maxMembers} members
          </span>
        </div>
      </div>

      {/* Description */}
      {room.description && <p className="room-card-description">{room.description}</p>}

      {/* Actions */}
      <div className="room-card-actions">
        {!hideDetails && (
          <Link to={`/room/${room.id}`} className="room-card-btn room-card-btn-primary">
            View Details
          </Link>
        )}
        {onJoin && (
          <button onClick={() => onJoin(room)} className="room-card-btn room-card-btn-join">
            Join Room
          </button>
        )}
        {!hideContribute && !isTargetReached && (
          <Link to={`/room/${room.id}?contribute=1`} className="room-card-btn room-card-btn-accent">
            Contribute
          </Link>
        )}
        {room.status === "ready" && !room.hasExecution && (
          <Link to={`/investment/${room.id}`} className="room-card-btn room-card-btn-accent">
            Invest Now
          </Link>
        )}
      </div>

      {/* Footer */}
      <div className="room-card-footer">
        <span className="room-card-created-date">Created {new Date(room.createdAt).toLocaleDateString()}</span>
        <div className="room-card-members-info">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
            />
          </svg>
          <span className="room-card-members-text">{room.members} members</span>
        </div>
      </div>
    </div>
  )
}

export default RoomCard
