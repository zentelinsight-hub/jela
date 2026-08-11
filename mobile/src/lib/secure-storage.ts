import * as SecureStore from 'expo-secure-store';

const chunkSize = 1800;

async function clearChunks(key: string, count: number) {
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(`${key}.${index}`),
    ),
  );
}

export const secureStorage = {
  async getItem(key: string) {
    const metadata = await SecureStore.getItemAsync(`${key}.meta`);
    if (!metadata) return null;

    const count = Number(metadata);
    if (!Number.isInteger(count) || count < 1) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${key}.${index}`),
      ),
    );
    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join('');
  },

  async setItem(key: string, value: string) {
    const oldMetadata = await SecureStore.getItemAsync(`${key}.meta`);
    const oldCount = Number(oldMetadata ?? 0);
    const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, 'gs')) ?? [''];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}.${index}`, chunk, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      ),
    );
    await SecureStore.setItemAsync(`${key}.meta`, String(chunks.length), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (oldCount > chunks.length) {
      await Promise.all(
        Array.from({ length: oldCount - chunks.length }, (_, index) =>
          SecureStore.deleteItemAsync(`${key}.${chunks.length + index}`),
        ),
      );
    }
  },

  async removeItem(key: string) {
    const metadata = await SecureStore.getItemAsync(`${key}.meta`);
    const count = Number(metadata ?? 0);
    if (count > 0) await clearChunks(key, count);
    await SecureStore.deleteItemAsync(`${key}.meta`);
  },
};
