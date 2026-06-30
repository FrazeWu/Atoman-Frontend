export function shouldRequireTurnstileConfig(isRegisterRoute: boolean, isProd: boolean, siteKey: string) {
  return isRegisterRoute && isProd && !siteKey
}
