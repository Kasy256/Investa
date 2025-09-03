import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * Custom hook for automatic data refresh
 * @param {Function} refreshFunction - Function to call for refreshing data
 * @param {number} intervalMs - Refresh interval in milliseconds (default: 5000ms)
 * @param {boolean} enabled - Whether auto-refresh is enabled (default: true)
 * @param {Array} dependencies - Dependencies that should trigger a refresh when changed
 */
export const useAutoRefresh = (refreshFunction, intervalMs = 5000, enabled = true, dependencies = []) => {
  const intervalRef = useRef(null)
  const refreshFunctionRef = useRef(refreshFunction)

  // Update the ref when refreshFunction changes
  useEffect(() => {
    refreshFunctionRef.current = refreshFunction
  }, [refreshFunction])

  // Wrapped refresh function that uses the ref
  const refresh = useCallback(() => {
    if (refreshFunctionRef.current) {
      refreshFunctionRef.current()
    }
  }, [])

  // Set up interval
  useEffect(() => {
    if (!enabled) {
      return
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Set up new interval
    intervalRef.current = setInterval(refresh, intervalMs)

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, intervalMs, refresh, ...dependencies])

  // Manual refresh function
  const manualRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  // Pause auto-refresh
  const pauseRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Resume auto-refresh
  const resumeRefresh = useCallback(() => {
    if (enabled && !intervalRef.current) {
      intervalRef.current = setInterval(refresh, intervalMs)
    }
  }, [enabled, intervalMs, refresh])

  return {
    manualRefresh,
    pauseRefresh,
    resumeRefresh,
    isRefreshing: intervalRef.current !== null
  }
}

/**
 * Hook for auto-refreshing with loading state management
 * @param {Function} refreshFunction - Function to call for refreshing data
 * @param {number} intervalMs - Refresh interval in milliseconds (default: 5000ms)
 * @param {boolean} enabled - Whether auto-refresh is enabled (default: true)
 */
export const useAutoRefreshWithLoading = (refreshFunction, intervalMs = 5000, enabled = true) => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const wrappedRefreshFunction = useCallback(async () => {
    try {
      setIsRefreshing(true)
      await refreshFunction()
    } catch (error) {
      console.error('Auto-refresh error:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshFunction])

  const { manualRefresh, pauseRefresh, resumeRefresh } = useAutoRefresh(
    wrappedRefreshFunction,
    intervalMs,
    enabled
  )

  return {
    manualRefresh,
    pauseRefresh,
    resumeRefresh,
    isRefreshing
  }
}
