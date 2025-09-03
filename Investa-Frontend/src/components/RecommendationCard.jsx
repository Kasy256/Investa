import { useState } from "react"
import "../styles/recommendation-card.css"

const RecommendationCard = ({ recommendation, userVote, onVote, totalMembers, roomAmount }) => {
  const [showDetails, setShowDetails] = useState(false)
  const [voting, setVoting] = useState(false)

  const handleVote = async (voteType) => {
    setVoting(true)
    await onVote(recommendation.id, voteType)
    setTimeout(() => setVoting(false), 500)
  }

  const getTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case "etf":
        return "blue"
      case "stock":
        return "green"
      case "crypto":
        return "purple"
      case "bond":
        return "gray"
      default:
        return "muted"
    }
  }

  const getRiskColor = (risk) => {
    switch (risk) {
      case "low":
        return "green"
      case "moderate":
        return "yellow"
      case "moderate-high":
        return "orange"
      case "high":
        return "red"
      default:
        return "muted"
    }
  }

  const investmentAmount = (roomAmount * recommendation.allocation) / 100
  const approvalPercentage = (recommendation.votes.approve / totalMembers) * 100
  const rejectionPercentage = (recommendation.votes.reject / totalMembers) * 100
  const isApproved =
    recommendation.votes.approve > recommendation.votes.reject &&
    recommendation.votes.approve >= Math.ceil(totalMembers / 2)

  return (
    <div className={`recommendation-card ${isApproved ? "approved" : ""}`}>
      {/* Header */}
      <div className="card-header">
        <div className="card-badges">
          <span className={`type-badge ${getTypeColor(recommendation.type)}`}>{recommendation.type}</span>
          <span className={`risk-badge ${getRiskColor(recommendation.riskLevel)}`}>
            {recommendation.riskLevel.replace("-", " ")} risk
          </span>
        </div>
        {isApproved && <div className="approved-badge">Approved</div>}
      </div>

      {/* Investment Info */}
      <div className="investment-info">
        <h3 className="investment-name">{recommendation.name}</h3>
        <p className="investment-description">{recommendation.description}</p>

        <div className="investment-details">
          <div className="detail-item">
            <span className="detail-label">Allocation:</span>
            <span className="detail-value">{recommendation.allocation}%</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Amount:</span>
            <span className="detail-value">${investmentAmount.toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Expected Return:</span>
            <span className="detail-value">{recommendation.expectedReturn}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Fees:</span>
            <span className="detail-value">{recommendation.fees}</span>
          </div>
        </div>
      </div>

      {/* Voting Progress */}
      <div className="voting-progress">
        <div className="voting-header">
          <span className="voting-title">Member Votes</span>
          <span className="voting-count">
            {recommendation.votes.approve + recommendation.votes.reject} of {totalMembers} voted
          </span>
        </div>

        <div className="voting-bars">
          <div className="voting-bar">
            <div className="progress-bar">
              <div className="progress-fill approve" style={{ width: `${approvalPercentage}%` }}></div>
            </div>
            <span className="vote-count approve">{recommendation.votes.approve} ✓</span>
          </div>

          <div className="voting-bar">
            <div className="progress-bar">
              <div className="progress-fill reject" style={{ width: `${rejectionPercentage}%` }}></div>
            </div>
            <span className="vote-count reject">{recommendation.votes.reject} ✗</span>
          </div>
        </div>
      </div>

      {/* Voting Buttons */}
      <div className="voting-buttons">
        <button
          onClick={() => handleVote("approve")}
          disabled={voting}
          className={`vote-button approve ${userVote === "approve" ? "active" : ""}`}
        >
          {voting && userVote !== "approve" ? (
            <div>
              <div className="voting-spinner"></div>
              Voting...
            </div>
          ) : (
            <>✓ Approve</>
          )}
        </button>

        <button
          onClick={() => handleVote("reject")}
          disabled={voting}
          className={`vote-button reject ${userVote === "reject" ? "active" : ""}`}
        >
          {voting && userVote !== "reject" ? (
            <div>
              <div className="voting-spinner"></div>
              Voting...
            </div>
          ) : (
            <>✗ Reject</>
          )}
        </button>
      </div>

      {/* Details Toggle */}
      <button onClick={() => setShowDetails(!showDetails)} className="details-toggle">
        {showDetails ? "Hide Details" : "Show Details"}
      </button>

      {/* Expanded Details */}
      {showDetails && (
        <div className="expanded-details">
          <div className="details-grid">
            {Object.entries(recommendation.details).map(([key, value]) => (
              <div key={key} className="detail-group">
                <span className="detail-group-label">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                <div className="detail-group-value">
                  {Array.isArray(value) ? (
                    <ul className="detail-list">
                      {value.slice(0, 3).map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                      {value.length > 3 && <li>+{value.length - 3} more</li>}
                    </ul>
                  ) : (
                    value
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecommendationCard
