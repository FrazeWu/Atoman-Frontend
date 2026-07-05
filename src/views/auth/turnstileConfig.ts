export function shouldRequireTurnstileConfig(isRegisterRoute: boolean, isProd: boolean, siteKey: string) {
  return isRegisterRoute && isProd && !siteKey
}

export function buildRegisterTurnstileKey(currentStep: number) {
  return `register-turnstile-step-${currentStep}`
}

function normalizeTurnstileErrorCode(errorCode?: string | number) {
  const normalized = Number(errorCode)
  return Number.isFinite(normalized) ? normalized : null
}

export function isRetryableTurnstileError(errorCode?: string | number) {
  const normalized = normalizeTurnstileErrorCode(errorCode)
  if (normalized === null) return false
  if (normalized === 200500) return true
  if (normalized >= 300000 && normalized < 400000) return true
  if (normalized >= 600000 && normalized < 700000) return true
  return false
}

export function resolveTurnstileErrorMessage(errorCode?: string | number) {
  const normalized = normalizeTurnstileErrorCode(errorCode)
  if (normalized === 110200) return '当前域名尚未完成验证配置，请稍后再试'
  if (normalized === 110100 || normalized === 110110 || normalized === 400070) {
    return '当前无法完成验证，请稍后再试'
  }
  return ''
}

export function shouldDisplayTurnstileError(errorCode?: string | number) {
  return resolveTurnstileErrorMessage(errorCode).length > 0
}
export function shouldRenderTurnstileForRegisterStep(
  isRegisterRoute: boolean,
  isProd: boolean,
  siteKey: string,
  currentStep: number,
) {
  return isRegisterRoute && isProd && !!siteKey && (currentStep === 1 || currentStep === 2)
}
