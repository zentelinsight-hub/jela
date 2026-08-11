import { describe, expect, it } from 'vitest';

import { destinationForSession } from '@/lib/routing';

describe('account routing', () => {
  it('keeps authority on the server-sourced status', () => {
    expect(destinationForSession(false)).toBe('auth');
    expect(destinationForSession(true, 'active')).toBe('chat');
    expect(destinationForSession(true, 'suspended')).toBe('account-blocked');
    expect(destinationForSession(true, 'disabled')).toBe('account-blocked');
  });
});
