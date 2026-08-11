import type { AccountStatus } from '@/types/database';

export type SessionDestination = 'auth' | 'chat' | 'account-blocked';

export function destinationForSession(
  hasSession: boolean,
  status?: AccountStatus | null,
): SessionDestination {
  if (!hasSession) return 'auth';
  if (status === 'suspended' || status === 'disabled') return 'account-blocked';
  return 'chat';
}
