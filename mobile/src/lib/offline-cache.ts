import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = 'jela.cache.v1.';
export async function cachedRequest<T>(key: string, request: () => Promise<T>) {
  try {
    const value = await request();
    await AsyncStorage.setItem(`${prefix}${key}`, JSON.stringify({ value, cachedAt: new Date().toISOString() }));
    return value;
  } catch (error) {
    const stored = await AsyncStorage.getItem(`${prefix}${key}`);
    if (!stored) throw error;
    try { return (JSON.parse(stored) as { value: T }).value; } catch { throw error; }
  }
}

export async function clearWorkspaceCache() {
  const keys = await AsyncStorage.getAllKeys();
  const matching = keys.filter((key) => key.startsWith(prefix));
  if (matching.length) await AsyncStorage.multiRemove(matching);
}

export async function readCache<T>(key: string) {
  const stored = await AsyncStorage.getItem(`${prefix}${key}`);
  if (!stored) return null;
  try { return (JSON.parse(stored) as { value: T }).value; } catch { return null; }
}
