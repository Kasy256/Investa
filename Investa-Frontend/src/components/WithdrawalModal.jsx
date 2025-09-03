import { useState } from "react"
import { X, ArrowUpRight, AlertCircle } from "lucide-react"
import "../styles/modal.css"
import { loadPaystack } from "../utils/paystack"
import { post } from "../api/client"

const WithdrawalModal = ({ wallet, userEmail, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: "",
    reason: ""
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
    
    // Clear errors when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Please enter a valid amount"
    } else if (Number.parseFloat(formData.amount) > wallet.balance) {
      newErrors.amount = "Amount exceeds available balance"
    } else if (Number.parseFloat(formData.amount) < 100) {
      newErrors.amount = "Minimum withdrawal amount is ₦100"
    } else if (Number.parseFloat(formData.amount) > 1000000) {
      newErrors.amount = "Maximum withdrawal amount is ₦1,000,000"
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
      const init = await post("/wallet/withdraw", { amount, reason: formData.reason })
      const CURRENCY = import.meta.env.VITE_PAYSTACK_CURRENCY || "KES"
      const handler = window.PaystackPop && window.PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: userEmail || "user@example.com",
        amount: Math.round(amount * 100),
        currency: CURRENCY,
        ref: init?.withdrawal?.reference || `WTH-${Date.now()}`,
        callback: function () {
          onSuccess?.({ amount, reason: formData.reason })
        },
        onClose: function () {},
      })
      if (handler) handler.openIframe()
    } catch (err) {
      setErrors((prev) => ({ ...prev, submit: err?.data?.error || err.message || "Withdrawal failed" }))
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'Ksh'
    }).format(amount)
  }

  const withdrawalAmount = Number.parseFloat(formData.amount) || 0
  const fee = 0 // No fee for now, but could be calculated here
  const totalAmount = withdrawalAmount + fee

  if (confirmStep) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-inner">
            <div className="modal-header">
              <h2 className="modal-title">Confirm Withdrawal</h2>
              <button onClick={onClose} className="modal-close-btn">
                <X />
              </button>
            </div>

            <div className="withdrawal-confirmation">
              <div className="confirmation-summary">
                <div className="summary-item">
                  <span className="summary-label">Amount:</span>
                  <span className="summary-value">{formatCurrency(withdrawalAmount)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Fee:</span>
                  <span className="summary-value">{formatCurrency(fee)}</span>
                </div>
                <div className="summary-item total">
                  <span className="summary-label">Total:</span>
                  <span className="summary-value">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              

              {formData.reason && (
                <div className="withdrawal-reason">
                  <h4>Reason (Optional)</h4>
                  <p>{formData.reason}</p>
                </div>
              )}

              

              {errors.submit && (
                <div className="error-alert">
                  <AlertCircle />
                  {errors.submit}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  className="modal-btn secondary"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="modal-btn primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner"></div>
                      Processing Withdrawal...
                    </>
                  ) : (
                    "Confirm Withdrawal"
                  )}
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
            <h2 className="modal-title">Withdraw Funds</h2>
            <button onClick={onClose} className="modal-close-btn">
              <X />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="modal-form">
            <div className="balance-info">
              <span className="wallet-balance-label">Available Balance:</span>
              <span className="wallet-balance-amount">{formatCurrency(wallet.balance)}</span>
            </div>

            <div className="form-group">
              <label htmlFor="amount" className="form-label">
                Withdrawal Amount
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
                  max={wallet.balance}
                  step="0.01"
                  disabled={loading}
                />
              </div>
              {errors.amount && <span className="error-message">{errors.amount}</span>}
              <div className="amount-limits">
                <span>Min: Ksh100</span>
                <span>Max: Ksh1,000,000</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reason" className="form-label">
                Reason (Optional)
              </label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className="form-textarea"
                placeholder="Why are you withdrawing these funds?"
                rows="3"
                disabled={loading}
              />
            </div>

            {errors.submit && (
              <div className="error-alert">
                <AlertCircle />
                {errors.submit}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                className="modal-btn secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn primary"
                disabled={loading}
              >
                <ArrowUpRight />
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default WithdrawalModal
