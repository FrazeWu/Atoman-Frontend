// Browser sessions use the HttpOnly session cookie, not a bearer token.
export function paperSocketProtocols(token: string | null | undefined): string[] | undefined {
  return token && token !== 'cookie-session' ? [`atoman.api.${token}`] : undefined
}
