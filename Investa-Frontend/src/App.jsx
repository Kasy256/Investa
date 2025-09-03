import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Header from "./components/Header"
import Footer from "./components/Footer"
import Dashboard from "./pages/Dashboard"
import Profile from "./pages/Profile"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import RoomDetail from "./pages/RoomDetail"
import InvestmentPage from "./pages/InvestmentPage"
import Analytics from "./pages/Analytics"
import ContributionHistory from "./pages/ContributionHistory"
import Rooms from "./pages/Rooms"
import Wallet from "./pages/Wallet"
import { AuthProvider, useAuth } from "./context/AuthContext"

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="app-container">
        {user && <Header />}

        <main className="main-content">
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
            <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/login" />} />
            <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
            <Route path="/rooms" element={user ? <Rooms user={user} /> : <Navigate to="/login" />} />
            <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
            <Route path="/room/:id" element={user ? <RoomDetail user={user} /> : <Navigate to="/login" />} />
            {/* Contribution handled via modal on RoomDetail; no separate route */}
            <Route
              path="/contributions"
              element={user ? <ContributionHistory user={user} /> : <Navigate to="/login" />}
            />
            <Route
              path="/investment/:roomId"
              element={user ? <InvestmentPage user={user} /> : <Navigate to="/login" />}
            />
            <Route path="/analytics" element={user ? <Analytics user={user} /> : <Navigate to="/login" />} />
            <Route path="/wallet" element={user ? <Wallet user={user} /> : <Navigate to="/login" />} />
            <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
          </Routes>
        </main>

        {user && <Footer />}
      </div>
    </Router>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
