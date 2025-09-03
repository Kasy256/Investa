import { useState, useEffect } from "react"
import { useParams, useNavigate, Link, useLocation } from "react-router-dom"
import "../styles/room-detail.css"
import ContributeModal from "../components/ContributeModal"
import { fetchRoom, fetchRoomMembers, leaveRoom, deleteRoom } from "../api/rooms"
import { fetchStopVoteAggregate } from "../api/investments"
import { formatMoney } from "../utils/currency"

const RoomDetail = ({ user }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showContribute, setShowContribute] = useState(false)
  const location = useLocation()
  const [stopVotes, setStopVotes] = useState(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const [roomData, memberData] = await Promise.all([fetchRoom(id), fetchRoomMembers(id)])
        if (!isMounted) return
        setRoom(roomData)
        setMembers(memberData)
        if (roomData?.hasExecution) {
          try {
            const agg = await fetchStopVoteAggregate(roomData.id)
            if (isMounted) setStopVotes(agg)
          } catch {}
        } else {
          setStopVotes(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [id, user?.uid])

  const refreshRoom = async () => {
    try {
      const [roomData, memberData] = await Promise.all([fetchRoom(id), fetchRoomMembers(id)])
      setRoom(roomData)
      setMembers(memberData)
      if (roomData?.hasExecution) {
        try {
          const agg = await fetchStopVoteAggregate(roomData.id)
          setStopVotes(agg)
        } catch {}
      } else {
        setStopVotes(null)
      }
    } catch {}
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const wantsContribute = params.get("contribute") === "1"
    if (wantsContribute) setShowContribute(true)
  }, [location.search])

  // Auto-poll stop vote aggregate every 5s when execution exists and room not closed
  useEffect(() => {
    if (!room?.hasExecution || room?.status === 'closed') return
    const intervalId = setInterval(async () => {
      try {
        const agg = await fetchStopVoteAggregate(room.id)
        setStopVotes(agg)
      } catch {}
    }, 5000)
    return () => clearInterval(intervalId)
  }, [room?.id, room?.hasExecution, room?.status])

  const handleLeaveRoom = async () => {
    if (room?.isCreator) {
      alert("Creators cannot leave their own room. You can delete the room instead.")
      return
    }
    if (!confirm("Are you sure you want to leave this room? This action cannot be undone.")) {
      return
    }

    setActionLoading(true)
    try {
      await leaveRoom(id)
      navigate("/dashboard")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteRoom = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this room? All members will be removed and this action cannot be undone.",
      )
    ) {
      return
    }

    setActionLoading(true)
    try {
      await deleteRoom(id)
      navigate("/dashboard")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="room-detail-container">
        <div className="room-detail-loading">
          <div className="room-detail-loading-content">
            <div className="room-detail-loading-spinner"></div>
            <p className="room-detail-loading-text">Loading room details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="room-detail-container">
        <div className="room-detail-error">
          <h1>Room Not Found</h1>
          <p>The investment room you're looking for doesn't exist or has been removed.</p>
          <Link to="/dashboard" className="room-detail-error-btn">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const progressPercentage = (room.collected / room.goal) * 100
  const isTargetReached = progressPercentage >= 100

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

  return (
    <div className="room-detail-container">
      {/* Header */}
      <div className="room-detail-header">
        <div className="room-detail-header-info">
          <div className="room-detail-nav">
            <Link to="/dashboard" className="room-detail-back-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="room-detail-title">{room.name}</h1>
          </div>
          <div className="room-detail-badges">
            <span className={`room-detail-badge ${getStatusColor(room.status)}`}>
              {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
            </span>
            <span className={`room-detail-badge ${getRiskColor(room.riskLevel)}`}>
              {(room.riskLevel || "").charAt(0).toUpperCase() + (room.riskLevel || "").slice(1)} Risk
            </span>
            {room.isCreator && <span className="room-detail-creator-badge">Creator</span>}
          </div>
        </div>

        <div className="room-detail-actions">
          {room.status === "ready" && !room.hasExecution && (
            <Link to={`/investment/${room.id}`} className="room-detail-btn accent">
              Invest Now
            </Link>
          )}
          {room.status !== "closed" && room.hasExecution && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link to={`/investment/${room.id}?mode=stop`} className="room-detail-btn destructive">
                End Investment
              </Link>
              {stopVotes && (
                <span className="room-detail-badge">
                  {stopVotes.votes || stopVotes?.votes === 0 ? `${stopVotes.votes}/${stopVotes.threshold}` : `${stopVotes?.votes ?? 0}/${stopVotes?.threshold ?? 0}`}
                </span>
              )}
            </div>
          )}
          {room.isCreator ? (
            <button onClick={handleDeleteRoom} disabled={actionLoading} className="room-detail-btn destructive">
              {actionLoading ? "Deleting..." : "Delete Room"}
            </button>
          ) : (
            <button onClick={handleLeaveRoom} disabled={actionLoading} className="room-detail-btn destructive">
              {actionLoading ? "Leaving..." : "Leave Room"}
            </button>
          )}
        </div>
      </div>

      <div className="room-detail-grid">
        {/* Main Content */}
        <div className="room-detail-main">
          {/* Room Info */}
          <div className="room-detail-card">
            <h2>Room Information</h2>
            <div className="room-detail-info">
              <div className="room-detail-field">
                <label className="room-detail-field-label">Description</label>
                <p className="room-detail-field-value">{room.description}</p>
              </div>
              <div className="room-detail-info-grid">
                <div className="room-detail-field">
                  <label className="room-detail-field-label">Investment Type</label>
                  <p className="room-detail-field-value font-medium">
                    {room.type.charAt(0).toUpperCase() + room.type.slice(1)}
                  </p>
                </div>
                <div className="room-detail-field">
                  <label className="room-detail-field-label">Room Code</label>
                  <p className="room-detail-field-value font-medium font-mono">{room.roomCode}</p>
                </div>
              </div>
              <div className="room-detail-field">
                <label className="room-detail-field-label">Created</label>
                <p className="room-detail-field-value">{new Date(room.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="room-detail-card progress-card">
            <h2>Investment Progress</h2>
            <div className="room-detail-progress">
              <div className="room-detail-progress-item">
                <span className="room-detail-progress-label">Current Amount</span>
                <span className="room-detail-progress-value large">{formatMoney(room.collected)}</span>
              </div>
              <div className="room-detail-progress-item">
                <span className="room-detail-progress-label">Target Goal</span>
                <span className="room-detail-progress-value medium">{formatMoney(room.goal)}</span>
              </div>
              <div className="room-detail-progress-bar">
                <div
                  className={`room-detail-progress-fill ${isTargetReached ? "target-reached" : "in-progress"}`}
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                ></div>
              </div>
              <div className="room-detail-progress-footer">
                <span className="room-detail-progress-text">{Math.round(progressPercentage)}% complete</span>
                <span className="room-detail-progress-text">
                  {formatMoney(room.goal - room.collected)} remaining
                </span>
              </div>
              {isTargetReached && (
                <div className="room-detail-success-alert">
                  <div className="room-detail-success-content">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="room-detail-success-text">Target reached! Ready to invest.</span>
                  </div>
                </div>
              )}
              {/* Inline Actions under progress */}
              <div className="room-detail-inline-actions">
                <button onClick={() => setShowContribute(true)} className="room-detail-action-btn primary">
                  Add Contribution
                </button>
                <button className="room-detail-action-btn secondary">Share Room Code</button>
                <Link to="/analytics" className="room-detail-action-btn muted">
                  View Analytics
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="room-detail-sidebar">
          {/* Members */}
          <div className="room-detail-card members-card">
            <div className="room-detail-members-header">
              <h2>Members</h2>
              <span className="room-detail-members-count">
                {room.members}/{room.maxMembers}
              </span>
            </div>
            <div className="room-detail-members-list">
              {members.map((member) => (
                <div key={member.id} className="room-detail-member">
                  <div className="room-detail-member-info">
                    <div className="room-detail-member-avatar">
                      <span>{(member.name?.charAt(0) || member.email?.charAt(0) || (member.userId || "U").charAt(0))}</span>
                    </div>
                    <div className="room-detail-member-details">
                      <div className="room-detail-member-name-row">
                        <span className="room-detail-member-name">{member.name || member.email || member.userId || "Unknown"}</span>
                        {member.isCreator && <span className="room-detail-member-creator-badge">Creator</span>}
                      </div>
                      <span className="room-detail-member-contribution">${Number(member.contribution || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          
        </div>
      </div>
      {showContribute && (
        <ContributeModal
          room={room}
          user={user}
          onClose={() => setShowContribute(false)}
          onSuccess={async ({ amount }) => {
            await refreshRoom()
          }}
        />
      )}
    </div>
  )
}

export default RoomDetail
