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

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return translateErrorCode(error.message) || error.message
  }
  if (!error || typeof error !== 'object') return fallback

  const value = error as { error?: unknown; message?: unknown }
  if (typeof value.error === 'string' && value.error) {
    return translateErrorCode(value.error) || value.error
  }
  if (value.error && typeof value.error === 'object') {
    const nested = value.error as { code?: unknown; message?: unknown }
    const nestedCodeMessage = translateErrorCode(nested.code)
    if (nestedCodeMessage) return nestedCodeMessage
    const nestedMessage = nested.message
    if (typeof nestedMessage === 'string' && nestedMessage) return nestedMessage
  }
  const codeMessage = translateErrorCode((value as { code?: unknown }).code)
  if (codeMessage) return codeMessage
  return typeof value.message === 'string' && value.message ? value.message : fallback
}
