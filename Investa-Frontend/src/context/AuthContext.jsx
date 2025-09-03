import { createContext, useContext, useState, useEffect } from "react"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth"
import { auth } from "../firebase"
import { post } from "../api/client"

const AuthContext = createContext()

export { AuthContext }

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Sign up function
  const signup = async (email, password, displayName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(userCredential.user, { displayName })
    try {
      const token = await userCredential.user.getIdToken()
      await post("/auth/verify-token", { token })
    } catch {}
    return userCredential
  }

  // Login function
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    try {
      const token = await userCredential.user.getIdToken()
      await post("/auth/verify-token", { token })
    } catch {}
    return userCredential
  }

  // Logout function
  const logout = () => {
    return signOut(auth)
  }

  // Update user profile
  const updateUserProfile = (updates) => {
    return updateProfile(auth.currentUser, updates)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      if (user) {
        try {
          const token = await user.getIdToken()
          await post("/auth/verify-token", { token })
        } catch {}
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    user,
    signup,
    login,
    logout,
    updateUserProfile,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
