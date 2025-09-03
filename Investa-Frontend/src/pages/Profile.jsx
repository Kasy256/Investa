import { useState, useEffect } from "react"
import { fetchUserProfile, updateUserProfile, fetchUserStats } from "../api/users"
import { formatMoney } from "../utils/currency"
import {useAutoRefresh} from "../hooks/useAutoRefresh"
import "../styles/profile.css"

const Profile = ({ user, setUser }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    displayName: user?.displayName || "",
    email: user?.email || "",
    riskPreference: user?.riskPreference || "moderate",
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [userStats, setUserStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Fetch user stats on component mount
  const loadUserStats = async () => {
    try {
      setStatsLoading(true)
      const stats = await fetchUserStats()
      setUserStats(stats)
    } catch (error) {
      console.error("Error loading user stats:", error)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    loadUserStats()
  }, [])

  // Auto-refresh user stats every 5 seconds
  const { manualRefresh } = useAutoRefresh(loadUserStats, 5000, true)

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

    if (!formData.displayName.trim()) {
      newErrors.displayName = "Name is required"
    }

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid"
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
    setErrors({})
    setSuccess("")

    try {
      // Update profile via API
      const updatedUser = await updateUserProfile({
        displayName: formData.displayName,
        riskPreference: formData.riskPreference,
      })
      
      // Update the user state with the response
      setUser((prev) => ({
        ...prev,
        displayName: updatedUser.displayName,
        riskPreference: updatedUser.riskPreference,
      }))
      
      setIsEditing(false)
      setSuccess("Profile updated successfully!")
    } catch (error) {
      setErrors({ submit: error.message || "Failed to update profile" })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      displayName: user?.displayName || "",
      email: user?.email || "",
      riskPreference: user?.riskPreference || "moderate",
    })
    setIsEditing(false)
    setErrors({})
    setSuccess("")
  }

  const getRiskColor = (risk) => {
    switch (risk) {
      case "conservative":
        return "conservative"
      case "moderate":
        return "moderate"
      case "aggressive":
        return "aggressive"
      default:
        return ""
    }
  }

  const getRiskLabel = (risk) => {
    switch (risk) {
      case "conservative":
        return "Conservative"
      case "moderate":
        return "Moderate"
      case "aggressive":
        return "Aggressive"
      default:
        return "Not set"
    }
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        {/* Header */}
        <div className="profile-header">
          <div className="profile-header-info">
            <h1>Profile</h1>
            <p>Manage your account settings and preferences</p>
          </div>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="profile-edit-btn">
              Edit Profile
            </button>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="auth-success-alert">
            <p>{success}</p>
          </div>
        )}

        {/* Profile Content */}
        {isEditing ? (
          /* Edit Form */
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="profile-form-grid">
              {/* Display Name */}
              <div className="profile-form-group">
                <label htmlFor="displayName" className="profile-form-label">
                  Full Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={formData.displayName}
                  onChange={handleChange}
                  className={`profile-form-input ${errors.displayName ? "error" : ""}`}
                  placeholder="Enter your full name"
                />
                {errors.displayName && <p className="profile-form-error">{errors.displayName}</p>}
              </div>

              {/* Email */}
              <div className="profile-form-group">
                <label htmlFor="email" className="profile-form-label">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`profile-form-input ${errors.email ? "error" : ""}`}
                  placeholder="Enter your email"
                />
                {errors.email && <p className="profile-form-error">{errors.email}</p>}
              </div>
            </div>

            {/* Risk Preference */}
            <div className="profile-form-group">
              <label htmlFor="riskPreference" className="profile-form-label">
                Investment Risk Preference
              </label>
              <select
                id="riskPreference"
                name="riskPreference"
                value={formData.riskPreference}
                onChange={handleChange}
                className="profile-form-select"
              >
                <option value="conservative">Conservative - Lower risk, stable returns</option>
                <option value="moderate">Moderate - Balanced risk and returns</option>
                <option value="aggressive">Aggressive - Higher risk, higher potential returns</option>
              </select>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="auth-error-alert">
                <p>{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="profile-actions">
              <button type="submit" disabled={loading} className="profile-save-btn">
                {loading ? (
                  <>
                    <div className="profile-loading-spinner"></div>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
              <button type="button" onClick={handleCancel} className="profile-cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* Display Mode */
          <div className="profile-display">
            {/* Profile Info */}
            <div className="profile-info-grid">
              <div className="profile-section">
                <h3>Personal Information</h3>
                <div className="profile-field-group">
                  <div className="profile-field">
                    <label className="profile-field-label">Full Name</label>
                    <p className="profile-field-value">{user?.displayName || "Not set"}</p>
                  </div>
                  <div className="profile-field">
                    <label className="profile-field-label">Email Address</label>
                    <p className="profile-field-value">{user?.email || "Not set"}</p>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h3>Investment Preferences</h3>
                <div className="profile-field">
                  <label className="profile-field-label">Risk Preference</label>
                  <span className={`risk-badge ${getRiskColor(user?.riskPreference)}`}>
                    {getRiskLabel(user?.riskPreference)}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Stats */}
            <div className="account-stats">
              <h3>Account Overview</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">
                    {statsLoading ? "..." : (userStats?.investmentRooms || 0)}
                  </div>
                  <div className="stat-label">Investment Rooms</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {statsLoading ? "..." : formatMoney(userStats?.totalInvested || 0)}
                  </div>
                  <div className="stat-label">Total Invested</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {statsLoading ? "..." : formatMoney(userStats?.totalReturns || 0)}
                  </div>
                  <div className="stat-label">Total Returns</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
