export const CURRENCY_CODE = import.meta.env.VITE_PAYSTACK_CURRENCY || 'KES'
export const LOCALE = 'en-KE'
export const CURRENCY_LABEL = CURRENCY_CODE === 'KES' ? 'KSh' : CURRENCY_CODE

export function formatMoney(amount) {
  const safe = Number(amount || 0)
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY_CODE, currencyDisplay: 'symbol' }).format(safe)
  } catch {
    return `${CURRENCY_LABEL} ${safe.toLocaleString()}`
  }
}

