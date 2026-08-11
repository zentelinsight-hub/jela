export function compareVersions(left: string, right: string) {
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);

  const a = normalize(left);
  const b = normalize(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference > 0) return 1;
    if (difference < 0) return -1;
  }
  return 0;
}

export type UpdateState = 'current' | 'available' | 'required';

export function resolveUpdateState(
  installedVersion: string,
  latestVersion: string,
  minimumSupportedVersion?: string | null,
  forceUpdate = false,
): UpdateState {
  if (
    (minimumSupportedVersion &&
      compareVersions(installedVersion, minimumSupportedVersion) < 0) ||
    (forceUpdate && compareVersions(installedVersion, latestVersion) < 0)
  ) {
    return 'required';
  }
  return compareVersions(installedVersion, latestVersion) < 0 ? 'available' : 'current';
}
