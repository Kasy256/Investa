import { useState, useContext, useEffect } from "react"
import { X, Wallet, AlertCircle, Info, TrendingUp, Plus } from "lucide-react"
import { AuthContext } from "../context/AuthContext"
import { createContribution } from "../api/contributions"
import "../styles/contribution.css"
import { formatMoney, CURRENCY_LABEL } from "../utils/currency"
import { fetchWallet } from "../api/wallet"

const ContributeModal = ({ room, user, onClose, onSuccess }) => {
  const { user: authUser } = useContext(AuthContext)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    amount: ""
  })

  const [wallet, setWallet] = useState(null)
  const [walletLoading, setWalletLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const w = await fetchWallet()
        if (!isMounted) return
        setWallet(w)
      } finally {
        if (isMounted) setWalletLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    const amount = Number.parseFloat(formData.amount)

    if (!formData.amount || amount <= 0) {
      newErrors.amount = "Amount must be greater than 0"
    } else if (amount < 100) {
      newErrors.amount = `Minimum contribution is ${CURRENCY_LABEL} 100`
    } else if (amount > 1000000) {
      newErrors.amount = `Maximum contribution is ${CURRENCY_LABEL} 1,000,000`
    } else if (!wallet || walletLoading) {
      newErrors.amount = "Loading wallet..."
    } else if (amount > (wallet?.balance || 0)) {
      newErrors.amount = "Insufficient wallet balance"
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
      const contributionAmount = Number.parseFloat(formData.amount)
      await createContribution({ roomId: room.id, amount: contributionAmount })
      setSuccess(`Successfully contributed ${formatMoney(contributionAmount)} to ${room.name}!`)
      if (onSuccess) {
        onSuccess({ amount: contributionAmount, roomId: room.id })
      }
      setTimeout(() => onClose?.(), 1500)
    } catch (err) {
      setErrors((prev) => ({ ...prev, submit: err?.data?.error || err.message || "Failed to contribute" }))
    } finally {
      setLoading(false)
    }
  }

  const remainingAmount = room ? room.goal - room.collected : 0
  const contributionAmount = Number.parseFloat(formData.amount) || 0
  const currentBalance = wallet?.balance || 0
  const newBalance = currentBalance - contributionAmount

  const formatCurrency = (amount) => formatMoney(amount)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-inner">
          <div className="modal-header">
            <h2 className="modal-title">Wallet Contribution to {room.name}</h2>
            <button onClick={onClose} className="modal-close-btn">
              <X />
            </button>
          </div>

          {success && (
            <div className="contribution-success-alert">
              <div className="contribution-success-content">
                <TrendingUp className="success-icon" />
                <span className="contribution-success-text">{success}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="contribution-form">
            {/* Wallet Balance Info */}
            <div className="wallet-balance-info">
              <div className="wallet-balance-header">
                <Wallet className="wallet-icon" />
                <div className="wallet-balance-details">
                  <span className="wallet-balance-label">Available Balance</span>
                  <span className="wallet-balance-amount">{walletLoading ? "..." : formatCurrency(currentBalance)}</span>
              </div>
            </div>
              <div className="wallet-balance-note">
                <Info className="info-icon" />
                <span>Contributions are deducted from your wallet balance</span>
              </div>
            </div>

            {/* Contribution Amount */}
                <div className="contribution-form-group">
              <label htmlFor="amount" className="contribution-form-label">
                Contribution Amount ({CURRENCY_LABEL})
              </label>
              <div className="contribution-amount-wrapper">
                <span className="contribution-amount-symbol">{CURRENCY_LABEL}</span>
                <input 
                  id="amount" 
                  name="amount" 
                  type="number" 
                  min="100" 
                  max="1000000" 
                  step="100" 
                  value={formData.amount} 
                  onChange={handleChange} 
                  className={`contribution-form-input with-symbol ${errors.amount ? "error" : ""}`} 
                  placeholder="0.00" 
                />
                </div>
              {errors.amount && <p className="contribution-form-error">{errors.amount}</p>}
              <p className="contribution-form-help">
                Remaining to goal: {formatCurrency(remainingAmount)}
              </p>
                </div>

            {/* Contribution Preview */}
            {formData.amount && !errors.amount && (
              <div className="contribution-preview">
                <h4>Wallet Contribution Summary</h4>
                <div className="preview-item">
                  <span className="preview-label">Contribution Amount:</span>
                  <span className="preview-value">{formatCurrency(contributionAmount)}</span>
                  </div>
                <div className="preview-item">
                  <span className="preview-label">Current Wallet Balance:</span>
                  <span className="preview-value">{formatCurrency(currentBalance)}</span>
                  </div>
                <div className="preview-item">
                  <span className="preview-label">Balance After Contribution:</span>
                  <span className="preview-value">{formatCurrency(newBalance)}</span>
                </div>
                <div className="preview-item total">
                  <span className="preview-label">Transaction Type:</span>
                  <span className="preview-value">Wallet Transfer (No Fees)</span>
                </div>
              </div>
            )}

            {/* Room Information */}
            <div className="room-info">
              <h4>Room Details</h4>
              <div className="room-details">
                <div className="room-detail-item">
                  <span className="detail-label">Room Name:</span>
                  <span className="detail-value">{room.name}</span>
                </div>
                <div className="room-detail-item">
                  <span className="detail-label">Goal:</span>
                  <span className="detail-value">{formatCurrency(room.goal)}</span>
                </div>
                <div className="room-detail-item">
                  <span className="detail-label">Collected:</span>
                  <span className="detail-value">{formatCurrency(room.collected)}</span>
                </div>
                <div className="room-detail-item">
                  <span className="detail-label">Progress:</span>
                  <span className="detail-value">
                    {((room.collected / room.goal) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Insufficient Balance Warning */}
            {formData.amount && Number.parseFloat(formData.amount) > currentBalance && (
              <div className="insufficient-balance-warning">
                <AlertCircle className="warning-icon" />
                <div className="warning-content">
                  <h4>Insufficient Balance</h4>
                  <p>Your wallet balance is insufficient for this contribution. Please top up your wallet first.</p>
                  <button 
                    type="button" 
                    className="topup-wallet-btn"
                    onClick={() => {
                      onClose?.()
                      window.location.href = "/wallet"
                    }}
                  >
                    <Plus />
                    Top Up Wallet
                  </button>
                </div>
              </div>
            )}

            {errors.submit && (
              <div className="auth-error-alert">
                <p>{errors.submit}</p>
              </div>
            )}

            <div className="modal-actions">
              <button 
                type="submit" 
                disabled={loading || walletLoading || !formData.amount || Number.parseFloat(formData.amount) > currentBalance} 
                className="modal-submit-btn"
              >
                {loading ? (
                  <>
                    <div className="modal-loading-spinner"></div> 
                    Processing Contribution...
                  </>
                ) : (
                  `Contribute - ${formatCurrency(contributionAmount)}`
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

export default ContributeModal


