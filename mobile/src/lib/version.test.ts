import { describe, expect, it } from 'vitest';

import { compareVersions, resolveUpdateState } from '@/lib/version';

describe('version policy', () => {
  it('compares semantic version segments without string ordering bugs', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('v2.0', '2.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('requires an update only below the minimum or when forced', () => {
    expect(resolveUpdateState('1.0.0', '1.2.0', '1.1.0')).toBe('required');
    expect(resolveUpdateState('1.1.0', '1.2.0', '1.0.0')).toBe('available');
    expect(resolveUpdateState('1.2.0', '1.2.0', '1.0.0')).toBe('current');
    expect(resolveUpdateState('1.1.0', '1.2.0', null, true)).toBe('available');
  });
});
