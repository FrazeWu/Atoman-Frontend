export function shouldRequireTurnstileConfig(isRegisterRoute: boolean, isProd: boolean, siteKey: string) {
  return isRegisterRoute && isProd && !siteKey
}

export function buildRegisterTurnstileKey(currentStep: number) {
  return `register-turnstile-step-${currentStep}`
}

export function shouldRenderTurnstileForRegisterStep(
  isRegisterRoute: boolean,
  isProd: boolean,
  siteKey: string,
  currentStep: number,
) {
  return isRegisterRoute && isProd && !!siteKey && (currentStep === 1 || currentStep === 2)
}
