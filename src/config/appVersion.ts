const fallbackVersion = 'v0.0.0'

export const appVersion =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.trim()
    ? __APP_VERSION__.trim()
    : fallbackVersion
