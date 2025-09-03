import { useState, useEffect } from "react"
import { fetchUserRooms, joinRoom, createRoom as apiCreateRoom } from "../api/rooms"
import RoomCard from "../components/RoomCard"
import "../styles/dashboard.css"

const Rooms = ({ user }) => {
  const [rooms, setRooms] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [joinRoomId, setJoinRoomId] = useState("")
  const [loading, setLoading] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const data = await fetchUserRooms()
        if (!isMounted) return
        setRooms(data)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  const handleJoinRoom = async (e) => {
    e.preventDefault()
    if (!joinRoomId.trim()) return
    setJoinLoading(true)
    try {
      await joinRoom(joinRoomId.trim())
      const refreshed = await fetchUserRooms()
      setRooms(refreshed)
      setJoinRoomId("")
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
            <p className="loading-text">Loading your rooms...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-header-info">
          <h1>Your Rooms</h1>
          <p>Manage, create, or join investment rooms.</p>
        </div>
        <div className="dashboard-header-actions">
          <button onClick={() => setShowCreateForm(true)} className="dashboard-create-btn">Create Room</button>
        </div>
      </div>

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
            {joinLoading ? <><div className="modal-loading-spinner"></div>Joining...</> : "Join Room"}
          </button>
        </form>
      </div>

      <div className="rooms-section">
        <h2>Your Investment Rooms</h2>
        {rooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3>No Rooms Yet</h3>
            <p>Create your first investment room or join an existing one to get started.</p>
            <button onClick={() => setShowCreateForm(true)} className="empty-state-btn">Create Your First Room</button>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} user={user} />
            ))}
          </div>
        )}
      </div>

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
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = "Room name is required"
    if (!formData.goal || formData.goal <= 0) newErrors.goal = "Goal must be greater than 0"
    if (!formData.maxMembers || formData.maxMembers < 2 || formData.maxMembers > 50) newErrors.maxMembers = "Max members must be between 2 and 50"
    if (!formData.type) newErrors.type = "Investment type is required"
    if (!formData.riskLevel) newErrors.riskLevel = "Risk level is required"
    if (!formData.visibility) newErrors.visibility = "Room visibility is required"
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
      const created = await apiCreateRoom(payload)
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
            <div className="modal-form-group">
              <label htmlFor="name" className="modal-form-label">Room Name</label>
              <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} className={`modal-form-input ${errors.name ? "error" : ""}`} placeholder="e.g., Tech Stocks Growth" />
              {errors.name && <p className="modal-form-error">{errors.name}</p>}
            </div>
            <div className="modal-form-group">
              <label htmlFor="goal" className="modal-form-label">Investment Goal ($)</label>
              <input id="goal" name="goal" type="number" min="1" value={formData.goal} onChange={handleChange} className={`modal-form-input ${errors.goal ? "error" : ""}`} placeholder="5000" />
              {errors.goal && <p className="modal-form-error">{errors.goal}</p>}
            </div>
            <div className="modal-form-group">
              <label htmlFor="maxMembers" className="modal-form-label">Maximum Members</label>
              <input id="maxMembers" name="maxMembers" type="number" min="2" max="50" value={formData.maxMembers} onChange={handleChange} className={`modal-form-input ${errors.maxMembers ? "error" : ""}`} placeholder="10" />
              {errors.maxMembers && <p className="modal-form-error">{errors.maxMembers}</p>}
            </div>
            <div className="modal-form-group">
              <label htmlFor="type" className="modal-form-label">Investment Type</label>
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
            <div className="modal-form-group">
              <label htmlFor="riskLevel" className="modal-form-label">Risk Level</label>
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
            <div className="modal-form-group">
              <label htmlFor="visibility" className="modal-form-label">Room Visibility</label>
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
            <div className="modal-form-group">
              <label htmlFor="description" className="modal-form-label">Description (Optional)</label>
              <textarea id="description" name="description" rows={3} value={formData.description} onChange={handleChange} className="modal-form-textarea" placeholder="Describe your investment strategy..." />
            </div>
            {errors.submit && (
              <div className="auth-error-alert">
                <p>{errors.submit}</p>
              </div>
            )}
            <div className="modal-actions">
              <button type="submit" disabled={loading} className="modal-submit-btn">
                {loading ? <><div className="modal-loading-spinner"></div>Creating...</> : "Create Room"}
              </button>
              <button type="button" onClick={onClose} className="modal-cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Rooms


