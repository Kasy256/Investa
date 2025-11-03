import { useState, useEffect } from "react"
import { fetchUserRooms, fetchPublicRooms, joinRoom, createRoom } from "../api/rooms"
import RoomCard from "../components/RoomCard"
import { formatMoney } from "../utils/currency"
import "../styles/dashboard.css"

const Dashboard = ({ user }) => {
  const [rooms, setRooms] = useState([])
  const [publicRooms, setPublicRooms] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [joinRoomId, setJoinRoomId] = useState("")
  const [loading, setLoading] = useState(true)
  const [createLoading, setCreateLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)

  // Load dashboard data function
  const loadDashboardData = async () => {
    // Don't refresh if forms are being used
    if (showCreateForm || joinLoading || createLoading) return
    
    try {
      const [userRooms, pubRooms] = await Promise.all([fetchUserRooms(), fetchPublicRooms()])
      setRooms(userRooms)
      setPublicRooms(pubRooms)
    } catch (err) {
      console.error("Error loading dashboard data:", err)
    }
  }

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        await loadDashboardData()
      } catch (err) {
        // Optionally surface an error UI; for now keep empty lists
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  // Manual refresh function for dashboard data
  const refreshDashboardData = async () => {
    await loadDashboardData()
  }

  const handleJoinRoom = async (e) => {
    e.preventDefault()
    if (!joinRoomId.trim()) return

    setJoinLoading(true)
    try {
      const joined = await joinRoom(joinRoomId.trim())
      setRooms((prev) => [...prev, joined])
      setJoinRoomId("")
    } catch (err) {
      // Optionally handle error state
    } finally {
      setJoinLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-inner">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading your investment rooms...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-info">
          <h1>Investment Dashboard</h1>
          <p>Welcome back, {user?.displayName || user?.email?.split("@")[0]}! Manage your investment rooms below.</p>
        </div>
        <div className="dashboard-header-actions">
          <button 
            onClick={refreshDashboardData}
            className="refresh-votes-btn"
            title="Refresh dashboard data"
            disabled={showCreateForm || joinLoading || createLoading}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button onClick={() => setShowCreateForm(true)} className="dashboard-create-btn">
            Create Room
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-value">{rooms.length}</div>
          <div className="stat-label">Total Rooms</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {formatMoney(
              rooms.reduce((sum, room) => sum + (room.isCreator ? room.collected : room.collected / room.members), 0)
            )}
          </div>
          <div className="stat-label">Total Invested</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{rooms.filter((room) => room.status === "ready").length}</div>
          <div className="stat-label">Ready to Invest</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{rooms.filter((room) => room.status === "open").length}</div>
          <div className="stat-label">Active Rooms</div>
        </div>
      </div>

      {/* Join Room Section */}
      <div className="join-room-section">
        <h2>Join an Investment Room</h2>
        <form onSubmit={handleJoinRoom} className="join-room-form">
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            placeholder="Enter Room ID"
            className="join-room-input"
          />
          <button type="submit" disabled={joinLoading || !joinRoomId.trim()} className="join-room-btn">
            {joinLoading ? (
              <>
                <div className="modal-loading-spinner"></div>
                Joining...
              </>
            ) : (
              "Join Room"
            )}
          </button>
        </form>
      </div>

      {/* Rooms Grid */}
      <div className="rooms-section">
        <h2>Your Investment Rooms</h2>
        {rooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3>No Investment Rooms Yet</h3>
            <p>Create your first investment room or join an existing one to get started.</p>
            <button onClick={() => setShowCreateForm(true)} className="empty-state-btn">
              Create Your First Room
            </button>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} user={user} />
            ))}
          </div>
        )}
      </div>

      {/* Discovery Section */}
      <div className="rooms-section">
        <h2>Discover Public Rooms</h2>
        {publicRooms.length === 0 ? (
          <p className="mb-md">No public rooms available right now.</p>
        ) : (
          <div className="rooms-grid">
            {publicRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                user={user}
                onJoin={async (r) => {
                  try {
                    const joined = await joinRoom(r.id)
                    // After join, refetch user rooms to ensure normalized data
                    const refreshed = await fetchUserRooms()
                    setRooms(refreshed)
                  } catch (err) {
                    // optionally handle error
                  }
                }}
                hideDetails={false}
                hideContribute={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateForm && (
        <CreateRoomModal
          onClose={() => setShowCreateForm(false)}
          onRoomCreated={(newRoom) => {
            setRooms((prev) => [...prev, newRoom])
            setShowCreateForm(false)
          }}
          user={user}
        />
      )}
    </div>
  )
}

// Create Room Modal Component
const CreateRoomModal = ({ onClose, onRoomCreated, user }) => {
  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    maxMembers: "",
    riskLevel: "",
    type: "",
    description: "",
    visibility: "",
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Room name is required"
    }

    if (!formData.goal || formData.goal <= 0) {
      newErrors.goal = "Investment goal must be greater than 0"
    }

    if (!formData.maxMembers || formData.maxMembers < 2 || formData.maxMembers > 50) {
      newErrors.maxMembers = "Max members must be between 2 and 50"
    }

    if (!formData.type) {
      newErrors.type = "Investment type is required"
    }

    if (!formData.riskLevel) {
      newErrors.riskLevel = "Risk level is required"
    }

    if (!formData.visibility) {
      newErrors.visibility = "Room visibility is required"
    }

    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validateForm()

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: formData.name,
        goal: Number.parseInt(formData.goal),
        maxMembers: Number.parseInt(formData.maxMembers),
        riskLevel: formData.riskLevel,
        type: formData.type,
        description: formData.description,
        visibility: formData.visibility,
      }
      const created = await createRoom(payload)
      onRoomCreated(created)
    } catch (err) {
      setErrors((prev) => ({ ...prev, submit: err?.data?.error || err.message || "Failed to create room" }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-inner">
          <div className="modal-header">
            <h2 className="modal-title">Create Investment Room</h2>
            <button onClick={onClose} className="modal-close-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="modal-form">
            {/* Room Name */}
            <div className="modal-form-group">
              <label htmlFor="name" className="modal-form-label">
                Room Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                className={`modal-form-input ${errors.name ? "error" : ""}`}
                placeholder="e.g., Tech Stocks Growth"
              />
              {errors.name && <p className="modal-form-error">{errors.name}</p>}
            </div>

            {/* Investment Goal */}
            <div className="modal-form-group">
              <label htmlFor="goal" className="modal-form-label">
                Investment Goal ($)
              </label>
              <input
                id="goal"
                name="goal"
                type="number"
                min="1"
                value={formData.goal}
                onChange={handleChange}
                className={`modal-form-input ${errors.goal ? "error" : ""}`}
                placeholder="5000"
              />
              {errors.goal && <p className="modal-form-error">{errors.goal}</p>}
            </div>

            {/* Max Members */}
            <div className="modal-form-group">
              <label htmlFor="maxMembers" className="modal-form-label">
                Maximum Members
              </label>
              <input
                id="maxMembers"
                name="maxMembers"
                type="number"
                min="2"
                max="50"
                value={formData.maxMembers}
                onChange={handleChange}
                className={`modal-form-input ${errors.maxMembers ? "error" : ""}`}
                placeholder="10"
              />
              {errors.maxMembers && <p className="modal-form-error">{errors.maxMembers}</p>}
            </div>

            {/* Investment Type */}
            <div className="modal-form-group">
              <label htmlFor="type" className="modal-form-label">
                Investment Type
              </label>
              <select 
                id="type" 
                name="type" 
                value={formData.type} 
                onChange={handleChange} 
                className={`modal-form-select ${errors.type ? "error" : ""}`}
              >
                <option value="">Select your option</option>
                <option value="mixed">Mixed Portfolio</option>
                <option value="stocks">Stocks</option>
                <option value="crypto">Cryptocurrency</option>
                <option value="bonds">Bonds</option>
                <option value="etf">ETFs</option>
              </select>
              {errors.type && <p className="modal-form-error">{errors.type}</p>}
            </div>

            {/* Risk Level */}
            <div className="modal-form-group">
              <label htmlFor="riskLevel" className="modal-form-label">
                Risk Level
              </label>
              <select
                id="riskLevel"
                name="riskLevel"
                value={formData.riskLevel}
                onChange={handleChange}
                className={`modal-form-select ${errors.riskLevel ? "error" : ""}`}
              >
                <option value="">Select your option</option>
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
              {errors.riskLevel && <p className="modal-form-error">{errors.riskLevel}</p>}
            </div>

            {/* Visibility */}
            <div className="modal-form-group">
              <label htmlFor="visibility" className="modal-form-label">
                Room Visibility
              </label>
              <select
                id="visibility"
                name="visibility"
                value={formData.visibility}
                onChange={handleChange}
                className={`modal-form-select ${errors.visibility ? "error" : ""}`}
              >
                <option value="">Select your option</option>
                <option value="public">Public (anyone can join)</option>
                <option value="private">Private (invite-only)</option>
              </select>
              {errors.visibility && <p className="modal-form-error">{errors.visibility}</p>}
            </div>

            {/* Description */}
            <div className="modal-form-group">
              <label htmlFor="description" className="modal-form-label">
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="modal-form-textarea"
                placeholder="Describe your investment strategy..."
              />
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="auth-error-alert">
                <p>{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="modal-actions">
              <button type="submit" disabled={loading} className="modal-submit-btn">
                {loading ? (
                  <>
                    <div className="modal-loading-spinner"></div>
                    Creating...
                  </>
                ) : (
                  "Create Room"
                )}
              </button>
              <button type="button" onClick={onClose} className="modal-cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
