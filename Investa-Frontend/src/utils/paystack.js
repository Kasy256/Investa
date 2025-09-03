let paystackScriptPromise

export function loadPaystack() {
  if (window.PaystackPop) return Promise.resolve()
  if (!paystackScriptPromise) {
    paystackScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://js.paystack.co/v1/inline.js"
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Failed to load Paystack script"))
      document.body.appendChild(script)
    })
  }
  return paystackScriptPromise
}


