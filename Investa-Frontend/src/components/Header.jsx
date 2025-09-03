import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import "../styles/header.css"

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (error) {
      console.error("Logout failed:", error)
      // Even if logout fails, redirect to login
      navigate("/login")
    }
  }

  const isActive = (path) => location.pathname === path

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          {/* Logo */}
          <Link to="/dashboard" className="logo-link">
            <span className="logo-text">Investa</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="desktop-nav">
            <Link to="/dashboard" className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}>
              Dashboard
            </Link>
            <Link to="/rooms" className={`nav-link ${isActive("/rooms") ? "active" : ""}`}>
              Rooms
            </Link>
            <Link to="/contributions" className={`nav-link ${isActive("/contributions") ? "active" : ""}`}>
              Contributions
            </Link>
            <Link to="/analytics" className={`nav-link ${isActive("/analytics") ? "active" : ""}`}>
              Analytics
            </Link>
            <Link to="/wallet" className={`nav-link ${isActive("/wallet") ? "active" : ""}`}>
              Wallet
            </Link>
            <Link to="/profile" className={`nav-link ${isActive("/profile") ? "active" : ""}`}>
              Profile
            </Link>
          </nav>

          {/* User Menu */}
          <div className="user-menu">
            <div className="user-info">
              <div className="user-avatar">
                <span>{user?.email?.charAt(0).toUpperCase() || "U"}</span>
              </div>
              <span className="user-email">{user?.email || "User"}</span>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>

            {/* Mobile menu button */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="mobile-menu-btn">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="mobile-nav">
            <nav className="mobile-nav-list">
              <Link
                to="/dashboard"
                className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/rooms"
                className={`nav-link ${isActive("/rooms") ? "active" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Rooms
              </Link>
              <Link
                to="/contributions"
                className={`nav-link ${isActive("/contributions") ? "active" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Contributions
              </Link>
              <Link
                to="/analytics"
                className={`nav-link ${isActive("/analytics") ? "active" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Analytics
              </Link>
              <Link
                to="/wallet"
                className={`nav-link ${isActive("/wallet") ? "active" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Wallet
              </Link>
              <Link
                to="/profile"
                className={`nav-link ${isActive("/profile") ? "active" : ""}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Profile
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
