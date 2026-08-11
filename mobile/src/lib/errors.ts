export class UserMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserMessageError';
  }
}

export function friendlyError(error: unknown, fallback: string) {
  if (error instanceof UserMessageError) return error.message;
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes('network request failed') || normalized.includes('failed to fetch')) {
      return 'Check your connection and try again.';
    }
    if (normalized.includes('timed out') || error.name === 'AbortError') {
      return 'The request took too long. Check your connection and try again.';
    }
  }
  return fallback;
}

export function authErrorMessage(error: { message?: string } | null | undefined, fallback: string) {
  const normalized = error?.message?.toLowerCase() ?? '';
  if (normalized.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (normalized.includes('email not confirmed')) return 'Verify your email before signing in.';
  if (normalized.includes('user already registered')) return 'An account already exists for this email.';
  if (normalized.includes('password') && normalized.includes('characters')) return 'Choose a stronger password that meets the requirements.';
  if (normalized.includes('rate limit') || normalized.includes('too many')) return 'Too many attempts. Wait a moment and try again.';
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Check your connection and try again.';
  return fallback;
}
