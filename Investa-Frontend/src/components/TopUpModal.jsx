import { useState } from "react"
import { X, AlertCircle } from "lucide-react"
import "../styles/modal.css"
import { loadPaystack } from "../utils/paystack"
import { post } from "../api/client"

const TopUpModal = ({ wallet, userEmail, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: "",
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [confirmStep, setConfirmStep] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }))
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Please enter a valid amount"
    } else if (Number.parseFloat(formData.amount) < 100) {
      newErrors.amount = "Minimum top-up amount is ₦100"
    } else if (Number.parseFloat(formData.amount) > 1000000) {
      newErrors.amount = "Maximum top-up amount is ₦1,000,000"
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
    // Open Paystack immediately
    await handleConfirm()
  }

  const handleConfirm = async () => {
    setLoading(true)
    setErrors({})
    try {
      const amount = Number.parseFloat(formData.amount)
      await loadPaystack()
      const init = await post("/wallet/topup", { amount })
      const CURRENCY = import.meta.env.VITE_PAYSTACK_CURRENCY || "KES"
      const handler = window.PaystackPop && window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: userEmail || "user@example.com",
        amount: Math.round(amount * 100),
        currency: CURRENCY,
        ref: init?.transaction?.reference || `TOP-${Date.now()}`,
        callback: function () {
          onSuccess?.(amount)
        },
        onClose: function () {},
      })
      if (handler) handler.openIframe()
    } catch (err) {
      setErrors(prev => ({ ...prev, submit: err?.data?.error || err.message || "Top-up failed" }))
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'Ksh' }).format(amount)

  const topUpAmount = Number.parseFloat(formData.amount) || 0

  if (confirmStep) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-inner">
            <div className="modal-header">
              <h2 className="modal-title">Confirm Top-up</h2>
              <button onClick={onClose} className="modal-close-btn">
                <X />
              </button>
            </div>

            <div className="topup-confirmation">
              <div className="confirmation-summary">
                <div className="summary-item">
                  <span className="summary-label">Top-up Amount:</span>
                  <span className="summary-value">{formatCurrency(topUpAmount)}</span>
                </div>
                <div className="summary-item total">
                  <span className="summary-label">Total to Pay:</span>
                  <span className="summary-value">{formatCurrency(topUpAmount)}</span>
                </div>
              </div>

              {errors.submit && (
                <div className="error-alert">
                  <AlertCircle />
                  {errors.submit}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={() => setConfirmStep(false)} className="modal-btn secondary" disabled={loading}>
                  Back
                </button>
                <button type="button" onClick={handleConfirm} className="modal-btn primary" disabled={loading}>
                  {loading ? (<><div className="loading-spinner"></div> Processing...</>) : ("Pay with Paystack")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-inner">
          <div className="modal-header">
            <h2 className="modal-title">Top-up Wallet</h2>
            <button onClick={onClose} className="modal-close-btn">
              <X />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="modal-form">
            <div className="balance-info">
              <span className="wallet-balance-label">Current Balance:</span>
              <span className="wallet-balance-amount">{formatCurrency(wallet.balance)}</span>
            </div>

            <div className="form-group">
              <label htmlFor="amount" className="form-label">
                Top-up Amount
              </label>
              <div className="amount-wrapper">
                <span className="amount-symbol">Ksh</span>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleChange}
                  className={`form-input with-symbol ${errors.amount ? "error" : ""}`}
                  placeholder="0.00"
                  min="100"
                  max="1000000"
                  step="100"
                  disabled={loading}
                />
              </div>
              {errors.amount && <span className="error-message">{errors.amount}</span>}
              <div className="amount-limits">
                <span>Min: Ksh100</span>
                <span>Max: Ksh1,000,000</span>
              </div>
            </div>

            {errors.submit && (
              <div className="error-alert">
                <AlertCircle />
                {errors.submit}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="modal-btn secondary" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="modal-btn primary" disabled={loading || !formData.amount}>
                Top Up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default TopUpModal
