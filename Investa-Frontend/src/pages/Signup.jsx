import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import "../styles/auth.css"

const Signup = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    riskPreference: "Select your risk preference",
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error when user starts typing
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

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
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

    try {
      await signup(formData.email, formData.password, formData.displayName)
      navigate("/dashboard")
    } catch (error) {
      setErrors({ submit: error.message })
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-form-wrapper">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <span>M</span>
            </div>
          </div>
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Join MicroInvest and start your investment journey</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-fields">
            {/* Display Name */}
            <div className="auth-form-group">
              <label htmlFor="displayName" className="auth-form-label">
                Full Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={formData.displayName}
                onChange={handleChange}
                className={`auth-form-input ${errors.displayName ? "error" : ""}`}
                placeholder="Enter your full name"
                disabled={loading}
              />
              {errors.displayName && <p className="auth-form-error">{errors.displayName}</p>}
            </div>

            {/* Email */}
            <div className="auth-form-group">
              <label htmlFor="email" className="auth-form-label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`auth-form-input ${errors.email ? "error" : ""}`}
                placeholder="Enter your email"
                disabled={loading}
              />
              {errors.email && <p className="auth-form-error">{errors.email}</p>}
            </div>

            {/* Risk Preference */}
            <div className="auth-form-group">
              <label htmlFor="riskPreference" className="auth-form-label">
                Risk Preference
              </label>
              <select
                id="riskPreference"
                name="riskPreference"
                value={formData.riskPreference}
                onChange={handleChange}
                className="auth-form-select"
                disabled={loading}
              >
                <option value="">Select your risk preference</option>
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            {/* Password */}
            <div className="auth-form-group">
              <label htmlFor="password" className="auth-form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className={`auth-form-input ${errors.password ? "error" : ""}`}
                placeholder="Create a password"
                disabled={loading}
              />
              {errors.password && <p className="auth-form-error">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="auth-form-group">
              <label htmlFor="confirmPassword" className="auth-form-label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`auth-form-input ${errors.confirmPassword ? "error" : ""}`}
                placeholder="Confirm your password"
                disabled={loading}
              />
              {errors.confirmPassword && <p className="auth-form-error">{errors.confirmPassword}</p>}
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && <p className="auth-form-error">{errors.submit}</p>}

          {/* Submit Button */}
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? (
              <>
                <div className="auth-loading-spinner"></div>
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <p className="auth-footer-text">
            Already have an account?{" "}
            <Link to="/login" className="auth-footer-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
