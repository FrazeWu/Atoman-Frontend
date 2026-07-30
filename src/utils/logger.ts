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

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (!error || typeof error !== 'object') return fallback

  const value = error as { error?: unknown; message?: unknown }
  if (typeof value.error === 'string' && value.error) return value.error
  if (value.error && typeof value.error === 'object') {
    const nestedMessage = (value.error as { message?: unknown }).message
    if (typeof nestedMessage === 'string' && nestedMessage) return nestedMessage
  }
  return typeof value.message === 'string' && value.message ? value.message : fallback
}
