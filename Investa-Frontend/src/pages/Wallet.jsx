import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { 
  Wallet as WalletIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  CreditCard, 
  Building2, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Download,
  Filter
} from "lucide-react"
import "../styles/wallet.css"
import TopUpModal from "../components/TopUpModal"
import WithdrawalModal from "../components/WithdrawalModal"
import { fetchWallet, fetchWalletTransactions, topup, requestWithdrawal } from "../api/wallet"
import { formatMoney } from "../utils/currency"

const Wallet = ({ user }) => {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showTopUp, setShowTopUp] = useState(false)
  const [filter, setFilter] = useState("all")
  const [refreshing, setRefreshing] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const [w, txns] = await Promise.all([
          fetchWallet(),
          fetchWalletTransactions(),
        ])
        if (!isMounted) return
        setWallet(w || { balance: 0, totalDeposited: 0, totalWithdrawn: 0, totalReturns: 0, currency: "KES" })
        setTransactions(txns)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])


  const getTransactionIcon = (type) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="transaction-icon deposit" />
      case "contribution":
        return <ArrowDownLeft className="transaction-icon contribution" />
      case "return":
        return <TrendingUp className="transaction-icon return" />
      case "refund":
        return <ArrowDownLeft className="transaction-icon refund" />
      case "withdrawal":
        return <ArrowUpRight className="transaction-icon withdrawal" />
      default:
        return <WalletIcon className="transaction-icon" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "status-completed"
      case "pending":
        return "status-pending"
      case "failed":
        return "status-failed"
      default:
        return ""
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="status-icon completed" />
      case "pending":
        return <Clock className="status-icon pending" />
      case "failed":
        return <XCircle className="status-icon failed" />
      default:
        return <AlertCircle className="status-icon" />
    }
  }

  const formatCurrency = (amount) => formatMoney(amount)

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredTransactions = transactions.filter(txn => {
    if (filter === "all") return true
    return txn.type === filter
  })

  // Calculate pending amount from transactions
  const pendingAmount = useMemo(() => {
    if (!transactions || transactions.length === 0) return 0
    
    // Sum pending withdrawal transactions (money pending to be withdrawn)
    const pendingWithdrawals = transactions
      .filter(t => t.status === 'pending' && t.type === 'withdrawal')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    
    // Sum pending deposit transactions (money pending to be added)
    const pendingDeposits = transactions
      .filter(t => t.status === 'pending' && t.type === 'deposit')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    
    // Pending = withdrawals pending (money locked) minus deposits pending (money incoming)
    // For display, we show the net pending withdrawals (money waiting to be withdrawn)
    return pendingWithdrawals
  }, [transactions])

  const refreshWalletData = async () => {
    // Don't refresh if modals are open
    if (isModalOpen) return
    
    setRefreshing(true)
    try {
      const [w, txns] = await Promise.all([
        fetchWallet(),
        fetchWalletTransactions(),
      ])
      setWallet(w || { balance: 0, totalDeposited: 0, totalWithdrawn: 0, totalReturns: 0, currency: "KES" })
      setTransactions(txns)
    } catch (error) {
      console.error("Error refreshing wallet data:", error)
    } finally {
      setRefreshing(false)
    }
  }




  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your wallet...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="wallet-page">
      <div className="wallet-container">
        {/* Header */}
        <div className="wallet-header">
          <div className="wallet-header-info">
            <h1 className="wallet-title">My Wallet</h1>
            <p className="wallet-subtitle">Manage your funds, transactions, and withdrawals</p>
          </div>
          <button 
            onClick={refreshWalletData}
            className="refresh-votes-btn"
            title="Refresh wallet data"
            disabled={refreshing || isModalOpen}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Balance Overview */}
        <div className="wallet-balance-section">
          <div className="wallet-balance-card">
            <div className="balance-header">
              <div className="balance-icon">
                <WalletIcon />
              </div>
                <p className="balance-label">Available Balance</p>
            </div>
            <div className="balance-stats">
              <h2 className="balance-amount">{formatCurrency(wallet.balance)}</h2>
            </div>
            <div className="balance-actions">
              <button 
                onClick={() => {
                  setShowTopUp(true)
                  setIsModalOpen(true)
                }} 
                className="balance-action-btn deposit"
              >
                <Plus />
                Top-up
              </button>
              <button 
                onClick={() => {
                  setShowWithdraw(true)
                  setIsModalOpen(true)
                }} 
                className="balance-action-btn withdraw"
                disabled={wallet.balance <= 0}
              >
                <ArrowUpRight />
                Withdraw
              </button>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-card-icon pending">
                <Clock />
              </div>
              <div className="summary-card-content">
                <div className="summary-card-label">Pending</div>
                <div className="summary-card-value">{formatCurrency(pendingAmount)}</div>
              </div>
            </div>
            
            <div className="summary-card">
              <div className="summary-card-icon earnings">
                <TrendingUp />
              </div>
              <div className="summary-card-content">
                <div className="summary-card-label">Total Earnings</div>
                <div className="summary-card-value">{formatCurrency(wallet.totalReturns || 0)}</div>
              </div>
            </div>
            
            <div className="summary-card">
              <div className="summary-card-icon spent">
                <ArrowDownLeft />
              </div>
              <div className="summary-card-content">
                <div className="summary-card-label">Total Deposited</div>
                <div className="summary-card-value">{formatCurrency(wallet.totalDeposited || 0)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="wallet-tabs">
          <button 
            className={`wallet-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button 
            className={`wallet-tab ${activeTab === "transactions" ? "active" : ""}`}
            onClick={() => setActiveTab("transactions")}
          >
            Transactions
          </button>
          <button 
            className={`wallet-tab ${activeTab === "withdrawals" ? "active" : ""}`}
            onClick={() => setActiveTab("withdrawals")}
          >
            Withdrawals
          </button>

        </div>

        {/* Tab Content */}
        <div className="wallet-content">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="overview-content">
              <div className="overview-grid">
                  <h3>Recent Transactions</h3>
                  <div className="recent-transactions">
                    {transactions && transactions.length > 0 ? (
                      transactions.slice(0, 5).map(txn => (
                        <div key={txn.id} className="recent-transaction">
                          <div className="transaction-info">
                            {getTransactionIcon(txn.type)}
                            <div className="transaction-details">
                              <span className="transaction-description">{txn.description}</span>
                              <span className="transaction-date">{formatDate(txn.date)}</span>
                            </div>
                          </div>
                          <div className="transaction-amount">
                            <span className={`amount ${txn.type === 'withdrawal' ? 'negative' : 'positive'}`}>
                              {txn.type === 'withdrawal' ? '-' : '+'}{formatCurrency(Math.abs(txn.amount))}
                            </span>
                            {getStatusIcon(txn.status)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-transactions">
                        <p>No recent transactions found</p>
                        <small>Transactions will appear here after you make deposits, withdrawals, or receive investment returns.</small>
                      </div>
                    )}
                  </div>
                  <Link to="/wallet?tab=transactions" className="view-all-link">
                    View all transactions →
                  </Link>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="transactions-content">
              <div className="transactions-header">
                <div className="transactions-filters">
                  <select 
                    value={filter} 
                    onChange={(e) => setFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Transactions</option>
                    <option value="deposit">Deposits</option>
                    <option value="contribution">Contributions</option>
                    <option value="return">Returns</option>
                    <option value="refund">Refunds</option>
                    <option value="withdrawal">Withdrawals</option>
                  </select>
                </div>
                <button className="export-btn">
                  <Download />
                  Export
                </button>
              </div>

              <div className="transactions-list">
                {filteredTransactions && filteredTransactions.length > 0 ? (
                  filteredTransactions.map(txn => (
                    <div key={txn.id} className="transaction-item">
                      <div className="transaction-main">
                        <div className="transaction-icon-wrapper">
                          {getTransactionIcon(txn.type)}
                        </div>
                        <div className="transaction-details">
                          <h4 className="transaction-title">{txn.description}</h4>
                          <div className="transaction-meta">
                            <span className="transaction-reference">Ref: {txn.reference}</span>
                            <span className="transaction-date">{formatDate(txn.date)}</span>
                          </div>
                          {txn.roomName && (
                            <Link to={`/room/${txn.roomId}`} className="room-link">
                              {txn.roomName}
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="transaction-amount-section">
                        <span className={`transaction-amount ${txn.type === 'withdrawal' ? 'negative' : 'positive'}`}>
                          {txn.type === 'withdrawal' ? '-' : '+'}{formatCurrency(Math.abs(txn.amount))}
                        </span>
                        <div className="transaction-status">
                          {getStatusIcon(txn.status)}
                          <span className={`status-text ${getStatusColor(txn.status)}`}>
                            {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-transactions">
                    <p>No transactions found</p>
                    <small>Transactions will appear here after you make deposits, withdrawals, or receive investment returns.</small>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === "withdrawals" && (
            <div className="withdrawals-content">
              <div className="withdrawals-header">
                <h3>Withdrawal History</h3>
                <button 
                  onClick={() => {
                    setShowWithdraw(true)
                    setIsModalOpen(true)
                  }} 
                  className="new-withdrawal-btn"
                  disabled={wallet.balance <= 0}
                >
                  <Plus />
                  New Withdrawal
                </button>
              </div>

              <div className="withdrawals-list">
                {withdrawals.map(withdrawal => (
                  <div key={withdrawal.id} className="withdrawal-item">
                    <div className="withdrawal-main">
                      <div className="withdrawal-icon-wrapper">
                        <ArrowUpRight className="withdrawal-icon" />
                      </div>
                      <div className="withdrawal-details">
                        <h4 className="withdrawal-title">
                          Withdrawal via {withdrawal.method}
                        </h4>
                        <div className="withdrawal-meta">
                          <span className="withdrawal-date">{formatDate(withdrawal.date)}</span>
                        </div>
                        <span className="withdrawal-reference">Ref: {withdrawal.reference}</span>
                      </div>
                    </div>
                    <div className="withdrawal-amount-section">
                      <span className="withdrawal-amount negative">
                        -{formatCurrency(withdrawal.amount)}
                      </span>
                      <div className="withdrawal-status">
                        {getStatusIcon(withdrawal.status)}
                        <span className={`status-text ${getStatusColor(withdrawal.status)}`}>
                          {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                        </span>
                      </div>
                      {withdrawal.failureReason && (
                        <span className="failure-reason">{withdrawal.failureReason}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          
        </div>
      </div>



             {/* Top-up Wallet Modal */}
       {showTopUp && (
         <TopUpModal 
           wallet={wallet}
           userEmail={user?.email}
           onClose={() => {
             setShowTopUp(false)
             setIsModalOpen(false)
           }}
           onSuccess={async () => {
             try {
               const [w, txns] = await Promise.all([
                 fetchWallet(),
                 fetchWalletTransactions(),
               ])
               setWallet(w)
               setTransactions(txns)
             } finally {
               setShowTopUp(false)
               setIsModalOpen(false)
             }
           }}
         />
       )}

       {/* Withdrawal Modal */}
       {showWithdraw && (
         <WithdrawalModal 
           wallet={wallet}
           userEmail={user?.email}
           onClose={() => {
             setShowWithdraw(false)
             setIsModalOpen(false)
           }}
           onSuccess={async () => {
             try {
               const [w, txns] = await Promise.all([
                 fetchWallet(),
                 fetchWalletTransactions(),
               ])
               setWallet(w)
               setTransactions(txns)
             } finally {
               setShowWithdraw(false)
               setIsModalOpen(false)
             }
           }}
         />
       )}
     </div>
   )
 }

export default Wallet
