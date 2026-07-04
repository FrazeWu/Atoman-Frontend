export function shouldRequireTurnstileConfig(isRegisterRoute: boolean, isProd: boolean, siteKey: string) {
  return isRegisterRoute && isProd && !siteKey
}

export function buildRegisterTurnstileKey(currentStep: number) {
  return `register-turnstile-step-${currentStep}`
}
