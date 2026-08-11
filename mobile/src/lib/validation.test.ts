import { describe, expect, it } from 'vitest';

import { chatInputSchema, signUpSchema } from '@/lib/validation';

describe('input validation', () => {
  it('rejects weak or mismatched account credentials', () => {
    expect(signUpSchema.safeParse({ firstName: 'Jo', lastName: 'Ok', email: 'bad', password: 'weak', confirmPassword: 'different' }).success).toBe(false);
  });

  it('accepts bounded, non-empty prompts', () => {
    expect(chatInputSchema.parse('  Plan my launch  ')).toBe('Plan my launch');
    expect(chatInputSchema.safeParse(' ').success).toBe(false);
    expect(chatInputSchema.safeParse('x'.repeat(8001)).success).toBe(false);
  });
});
