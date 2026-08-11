import { describe, expect, it } from 'vitest';

import { calculateCreditCharge, validateIdempotencyKey } from '@/lib/request-contract';

describe('AI request contract', () => {
  it('accepts UUID idempotency keys and rejects ambiguous values', () => {
    expect(validateIdempotencyKey('8da879aa-8a34-4d10-9e71-6869e496fa99')).toBe('8da879aa-8a34-4d10-9e71-6869e496fa99');
    expect(() => validateIdempotencyKey('retry-1')).toThrow();
  });

  it('rounds credit charges upward without negative values', () => {
    expect(calculateCreditCharge(700, 250, 2, 4)).toBe(3);
    expect(() => calculateCreditCharge(-1, 0, 1, 1)).toThrow();
  });
});
