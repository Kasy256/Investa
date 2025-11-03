import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import RecommendationCard from "../components/RecommendationCard"
import { fetchRoom } from "../api/rooms"
import { fetchInvestmentRecommendations } from "../api/analytics"
import { castVote, fetchVoteAggregate, executeInvestment, voteStopInvestment, fetchStopVoteAggregate, endInvestment } from "../api/investments"
import { formatMoney } from "../utils/currency"
import "../styles/investment.css"

const InvestmentPage = ({ user }) => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [userVotes, setUserVotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState("vote")
  const [stopAggs, setStopAggs] = useState({})
  const [showEndInvestment, setShowEndInvestment] = useState(false)
  const [endInvestmentSummary, setEndInvestmentSummary] = useState(null)
  const [isVoting, setIsVoting] = useState(false)

  // Load room data function
  const loadRoomData = async () => {
    // Don't refresh if user is currently voting
    if (isVoting) return
    
    try {
      const roomData = await fetchRoom(roomId)
      const recs = await fetchInvestmentRecommendations(roomData)
      setRoom(roomData)
      
      // Preserve existing vote data when updating recommendations
      setRecommendations((prevRecs) => {
        // If we have existing recommendations with vote data, preserve it
        if (prevRecs.length > 0 && prevRecs[0].votes) {
          return recs.map(newRec => {
            const existingRec = prevRecs.find(prev => prev.id === newRec.id)
            if (existingRec && existingRec.votes) {
              // Preserve the existing vote data
              return { ...newRec, votes: existingRec.votes }
            }
            // For new recommendations, use default vote structure
            return { 
              ...newRec, 
              votes: { 
                approve: 0, 
                reject: 0, 
                pending: Math.max(0, roomData?.members || 0) 
              } 
            }
          })
        }
        // Otherwise, use the fresh recommendations
        return recs
      })
      
      // Only reset userVotes if not currently voting
      if (!isVoting) {
        setUserVotes({})
      }
      const qs = new URLSearchParams(window.location.search)
      const m = qs.get("mode")
      setMode(m === "stop" ? "stop" : "vote")
    } catch (error) {
      console.error("Error loading room data:", error)
    }
  }

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        await loadRoomData()
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [roomId])

  // Manual refresh function for room data
  const refreshRoomData = async () => {
    await loadRoomData()
  }

  // Fetch vote aggregates once when entering vote mode (no automatic refresh)
  useEffect(() => {
    let cancelled = false
    async function loadVoteAggs() {
      if (mode !== 'vote' || !room || recommendations.length === 0) return
      const updates = await Promise.all(
        recommendations.map(async (rec) => {
          try {
            const agg = await fetchVoteAggregate(room.id, rec.id)
            const approve = Number(agg?.approve || 0)
            const reject = Number(agg?.reject || 0)
            const pending = Math.max(0, Number(room.members || 0) - approve - reject)
            return { id: rec.id, votes: { approve, reject, pending } }
          } catch {
            return { id: rec.id, votes: rec.votes }
          }
        })
      )
      if (!cancelled) {
        setRecommendations((prev) => prev.map((rec) => {
          const found = updates.find(u => u.id === rec.id)
          return found ? { ...rec, votes: found.votes } : rec
        }))
      }
    }
    // Only fetch once when entering vote mode
    loadVoteAggs()
    return () => { cancelled = true }
  }, [mode, room?.id, room?.members, recommendations])

  // Fetch per-asset stop vote aggregates when in stop mode
  useEffect(() => {
    let cancelled = false
    async function loadAggs() {
      if (mode !== 'stop' || !room) return
      const actives = recommendations.filter(r => r.allocation > 0)
      const entries = await Promise.all(
        actives.map(async (r) => {
          try {
            const agg = await fetchStopVoteAggregate(room.id, r.id)
            return [r.id, agg]
          } catch {
            return [r.id, null]
          }
        })
      )
      if (!cancelled) {
        const map = Object.fromEntries(entries)
        setStopAggs(map)
      }
    }
    loadAggs()
    return () => { cancelled = true }
  }, [mode, room?.id, recommendations])

  // Manual refresh function for stop vote aggregates
  const refreshStopAggregates = async () => {
    if (mode !== 'stop' || !room || isVoting) return
    try {
      const actives = recommendations.filter(r => r.allocation > 0)
      const entries = await Promise.all(
        actives.map(async (r) => {
          try {
            const agg = await fetchStopVoteAggregate(room.id, r.id)
            return [r.id, agg]
          } catch {
            return [r.id, null]
          }
        })
      )
      const map = Object.fromEntries(entries)
      setStopAggs(map)
    } catch (error) {
      console.error("Error refreshing stop aggregates:", error)
    }
  }

  const generateRecommendations = () => []

  const handleVote = async (recommendationId, voteType) => {
    if (!room || isVoting) return
    
    setIsVoting(true)
    try {
      await castVote({ roomId: room.id, recommendationId, vote: voteType })
      const agg = await fetchVoteAggregate(room.id, recommendationId)
      setUserVotes((prev) => ({ ...prev, [recommendationId]: voteType }))
      setRecommendations((prev) =>
        prev.map((rec) =>
          rec.id === recommendationId
            ? { ...rec, votes: { approve: agg.approve, reject: agg.reject, pending: Math.max(0, (room.members || 0) - agg.approve - agg.reject) } }
            : rec,
        ),
      )
    } catch (e) {
      console.error("Error casting vote:", e)
    } finally {
      // Resume refresh after a short delay to ensure vote is processed
      setTimeout(() => {
        setIsVoting(false)
      }, 1000)
    }
  }

  // Manual refresh function for vote aggregates (can be called when needed)
  const refreshVoteAggregates = async () => {
    if (mode !== 'vote' || !room || recommendations.length === 0) return
    try {
      const updates = await Promise.all(
        recommendations.map(async (rec) => {
          try {
            const agg = await fetchVoteAggregate(room.id, rec.id)
            const approve = Number(agg?.approve || 0)
            const reject = Number(agg?.reject || 0)
            const pending = Math.max(0, Number(room.members || 0) - approve - reject)
            return { id: rec.id, votes: { approve, reject, pending } }
          } catch {
            return { id: rec.id, votes: rec.votes }
          }
        })
      )
      setRecommendations((prev) => prev.map((rec) => {
        const found = updates.find(u => u.id === rec.id)
        return found ? { ...rec, votes: found.votes } : rec
      }))
    } catch (error) {
      console.error("Error refreshing vote aggregates:", error)
    }
  }

  if (loading) {
    return (
      <div className="investment-page">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading investment recommendations...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="investment-page">
        <div className="loading-content">
          <h1 className="investment-title">Room Not Found</h1>
          <Link to="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const totalVotes = room.members
  const approvedRecommendations = recommendations.filter(
    (rec) => rec.votes.approve > rec.votes.reject && rec.votes.approve >= Math.ceil(totalVotes / 2),
  )

  const activeInvestments = (room.hasExecution ? recommendations.filter((r) => r.allocation > 0) : [])

  const pendingVotesPerRec = (rec) => {
    const approve = Number(rec.votes?.approve || 0)
    const reject = Number(rec.votes?.reject || 0)
    const pending = Math.max(0, Number(room.members || 0) - approve - reject)
    return pending
  }
  const allMembersVotedOnAll = recommendations.length === 0 ? false : recommendations.every((r) => pendingVotesPerRec(r) === 0)
  const totalPendingAcrossAll = recommendations.reduce((sum, r) => sum + pendingVotesPerRec(r), 0)

  // Check if all members have voted to stop investments
  const allMembersVotedToStop = activeInvestments.length > 0 && activeInvestments.every((rec) => {
    const agg = stopAggs[rec.id]
    return agg && agg.votes >= agg.threshold
  })

  const handleEndInvestment = async () => {
    if (!room || !room.isCreator) {
      return
    }
    
    try {
      const result = await endInvestment(room.id)
      if (result?.success) {
        setEndInvestmentSummary(result.summary)
        setShowEndInvestment(true)
        // After showing summary, navigate to wallet to see the updated balance
        setTimeout(() => {
          navigate("/wallet")
        }, 5000)
      }
    } catch (error) {
      console.error("Error ending investment:", error)
      alert("Failed to end investment. Please try again.")
    }
  }

  return (
    <div className="investment-page">
      {/* Header */}
      <div className="investment-header">
        <div>
          <div className="investment-header-left">
            <Link to={`/room/${roomId}`} className="back-button">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="investment-title">Investment Recommendations</h1>
          </div>
          <p className="investment-subtitle">
            Review and vote on investment options for <strong>{room.name}</strong>
          </p>
        </div>

        <div className="investment-header-right">
          <div className="investment-amount">
            <div className="investment-amount-value">{formatMoney(room.collected)}</div>
            <div className="investment-amount-label">Available to Invest</div>
          </div>
          <button 
            onClick={async () => {
              await refreshRoomData()
              if (mode === "vote") {
                await refreshVoteAggregates()
              } else if (mode === "stop") {
                await refreshStopAggregates()
              }
            }}
            className="refresh-votes-btn"
            title="Refresh all data"
            disabled={isVoting}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Investment Summary */}
      <div className="investment-summary">
        <div className="summary-grid">
          <div>
            <div className="summary-item-value">{recommendations.length}</div>
            <div className="summary-item-label">Total Recommendations</div>
          </div>
          <div>
            <div className="summary-item-value">{approvedRecommendations.length}</div>
            <div className="summary-item-label">Approved Options</div>
          </div>
          <div>
            <div className="summary-item-value">{room.riskLevel}</div>
            <div className="summary-item-label">Risk Preference</div>
          </div>
          <div>
            <div className="summary-item-value">{totalVotes}</div>
            <div className="summary-item-label">Total Members</div>
          </div>
        </div>
      </div>

      {/* Voting Instructions */}
      <div className="voting-instructions">
        <div className="voting-instructions-content">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3>{mode === 'stop' ? 'How End-Investment Voting Works' : 'How Voting Works'}</h3>
            {mode === 'stop' ? (
              <p>
                Members vote to end a specific asset. When votes reach 70% of current members, the system secures
                current profit for that asset and distributes it proportionally to members based on their room contributions.
              </p>
            ) : (
            <p>
              Each member can vote to approve or reject investment recommendations. An option needs majority approval
              (at least {Math.ceil(totalVotes / 2)} votes) to be selected for investment. You can change your vote at
              any time before the final decision.
            </p>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations / Active Investments */}
      <div className="recommendations-section">
        <h2 className="recommendations-title">{mode === "stop" ? "Active Investments" : "Investment Options"}</h2>

        {(mode === "vote" ? recommendations : activeInvestments).length === 0 ? (
          <div className="no-recommendations">
            <div className="no-recommendations-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3>{mode === "stop" ? "No Active Investments" : "No Recommendations Available"}</h3>
            {mode !== "stop" && (
            <p>No suitable investment options found for your room's criteria. Please contact support for assistance.</p>
            )}
          </div>
        ) : (
          <div className="recommendations-grid">
            {(mode === "vote" ? recommendations : activeInvestments).map((recommendation) => (
              mode === "vote" ? (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                userVote={userVotes[recommendation.id]}
                onVote={handleVote}
                totalMembers={totalVotes}
                roomAmount={room.collected}
                isVoting={isVoting}
              />
              ) : (
                <div key={recommendation.id} className="approved-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span className="approved-item-name">{recommendation.name}</span>
                    <span className="approved-item-allocation">({recommendation.allocation}% allocation)</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="room-detail-badge">
                      {stopAggs[recommendation.id]?.votes ?? 0}/{stopAggs[recommendation.id]?.threshold ?? room.members}
                    </span>
                    <button
                      className="execute-button"
                      onClick={async () => {
                        try {
                          const res = await voteStopInvestment(room.id, recommendation.id, recommendation.name)
                          if (res?.stopped) {
                            alert("Investment ended and profits secured.")
                          } else {
                            alert(`Vote recorded to end investment (${res?.votes}/${res?.threshold})`)
                          }
                          try {
                            const agg = await fetchStopVoteAggregate(room.id, recommendation.id)
                            setStopAggs((prev) => ({ ...prev, [recommendation.id]: agg }))
                          } catch {}
                        } catch {}
                      }}
                    >
                      Vote to End
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>



      {/* End Investment Section */}
      {mode === "stop" && allMembersVotedToStop && room?.isCreator && (
        <div className="end-investment-section">
          <div className="end-investment-header">
            <h3>🎉 All Members Have Voted to End Investment!</h3>
            <p>You can now end the investment and distribute profits to all members.</p>
          </div>
          
          <div className="end-investment-summary">
            <div className="summary-card">
              <div className="summary-card-header">
                <h4>Investment Summary</h4>
              </div>
              <div className="summary-card-content">
                <div className="summary-row">
                  <span className="summary-label">Total Invested:</span>
                  <span className="summary-value">{formatMoney(room.collected)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Current Value:</span>
                  <span className="summary-value">{formatMoney(room.collected * 1.15)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Total Profit:</span>
                  <span className="summary-value profit">{formatMoney(room.collected * 0.15)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Members:</span>
                  <span className="summary-value">{room.members}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="end-investment-actions">
            <button
              className="end-investment-button"
              onClick={handleEndInvestment}
            >
              🚀 End Investment & Distribute Profits
            </button>
            <p className="end-investment-note">
              This will close the investment, distribute profits proportionally to all members based on their contributions, 
              and remove the room from analytics.
            </p>
          </div>
        </div>
      )}

      {/* End Investment Success Summary */}
      {showEndInvestment && endInvestmentSummary && (
        <div className="end-investment-success">
          <div className="success-header">
            <h3>✅ Investment Ended Successfully!</h3>
            <p>Profits have been distributed to all members' wallets.</p>
          </div>
          
          <div className="success-summary">
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Total Invested</span>
                <span className="summary-value">{formatMoney(endInvestmentSummary.total_invested)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Profit</span>
                <span className="summary-value profit">{formatMoney(endInvestmentSummary.total_profit)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Members</span>
                <span className="summary-value">{endInvestmentSummary.members_count}</span>
              </div>
            </div>
            
            <div className="profit-distribution">
              <h4>Profit Distribution</h4>
              <div className="distribution-list">
                {endInvestmentSummary.profit_distribution.map((member, index) => (
                  <div key={index} className="distribution-item">
                    <div className="member-info">
                      <span className="member-contribution">
                        Contributed: {formatMoney(member.contribution)}
                      </span>
                      <span className="member-profit">
                        Profit: {formatMoney(member.profit_share)}
                      </span>
                    </div>
                    <div className="member-total">
                      Total Return: {formatMoney(member.total_return)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="success-note">
            <p>Redirecting to dashboard in 5 seconds...</p>
          </div>
        </div>
      )}

      {/* Final Investment Summary */}
      {mode === "vote" && approvedRecommendations.length > 0 && (
        <div className="approved-investments">
          <h3>Approved Investments</h3>
          <div className="approved-list">
            {approvedRecommendations.map((rec) => (
              <div key={rec.id} className="approved-item">
                <div>
                  <span className="approved-item-name">{rec.name}</span>
                  <span className="approved-item-allocation">({rec.allocation}% allocation)</span>
                </div>
                <span className="approved-item-amount">{formatMoney((room.collected * rec.allocation) / 100)}</span>
              </div>
            ))}
          </div>
          <div className="approved-total">
            <span className="approved-total-label">Total Investment Amount</span>
            <span className="approved-total-amount">
              {formatMoney(approvedRecommendations.reduce((sum, rec) => sum + (room.collected * rec.allocation) / 100, 0))}
            </span>
          </div>

          {room.isCreator && (
            <div>
              <button
                className="execute-button"
                disabled={!allMembersVotedOnAll}
                title={!allMembersVotedOnAll ? `${totalPendingAcrossAll} pending vote(s) remaining across recommendations` : undefined}
                onClick={async () => {
                  if (!allMembersVotedOnAll) return
                  const allocations = approvedRecommendations.map((rec) => ({ id: rec.id, name: rec.name, allocation: rec.allocation }))
                  try {
                    await executeInvestment(room.id, allocations)
                    alert("Investment executed (simulated). View analytics for performance over time.")
                    navigate("/dashboard")
                  } catch {}
                }}
              >
                {allMembersVotedOnAll ? "Execute Investment Plan" : "Waiting for all members to vote"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default InvestmentPage
