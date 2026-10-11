// An in-memory localStorage for the persisted zustand stores, which expect a browser.
// Import this before any store.
const data = new Map<string, string>();

const memoryStorage: Storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => {
    data.set(key, String(value));
  },
  removeItem: (key) => {
    data.delete(key);
  },
  clear: () => data.clear(),
  key: (index) => Array.from(data.keys())[index] ?? null,
  get length() {
    return data.size;
  },
};

(globalThis as unknown as {localStorage: Storage}).localStorage = memoryStorage;
