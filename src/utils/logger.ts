export type ErrorReporter = (error: unknown, context?: string) => void

let errorReporter: ErrorReporter | null = null

export function configureErrorReporter(reporter: ErrorReporter | null) {
  errorReporter = reporter
}

export function reportError(error: unknown, context?: string) {
  if (errorReporter) {
    errorReporter(error, context)
    return
  }

  if (import.meta.env.DEV) {
    console.error(context ? `${context}:` : 'Unexpected error', error)
  }
}

const userFacingErrorMessages: Record<string, string> = {
  site_access_conflict: '站点设置已被其他管理员更新，请刷新后重试',
  'system.internal_error': '系统暂时无法完成操作，请稍后重试',
}

function translateErrorCode(value: unknown): string | undefined {
  return typeof value === 'string' ? userFacingErrorMessages[value] : undefined
}

function chineseMessageOrFallback(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value) return fallback
  return translateErrorCode(value) || (/[㐀-鿿]/.test(value) ? value : fallback)
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return chineseMessageOrFallback(error.message, fallback)
  }
  if (!error || typeof error !== 'object') return fallback

  const value = error as { error?: unknown; message?: unknown }
  if (typeof value.error === 'string' && value.error) {
    return chineseMessageOrFallback(value.error, fallback)
  }
  if (value.error && typeof value.error === 'object') {
    const nested = value.error as { code?: unknown; message?: unknown }
    const nestedCodeMessage = translateErrorCode(nested.code)
    if (nestedCodeMessage) return nestedCodeMessage
    const nestedMessage = nested.message
    if (typeof nestedMessage === 'string' && nestedMessage) return chineseMessageOrFallback(nestedMessage, fallback)
  }
  const codeMessage = translateErrorCode((value as { code?: unknown }).code)
  if (codeMessage) return codeMessage
  return chineseMessageOrFallback(value.message, fallback)
}
