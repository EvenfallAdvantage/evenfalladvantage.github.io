// Test setup for Vitest (node environment)

// Mock crypto.randomUUID if not available
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => "00000000-0000-0000-0000-000000000000",
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
    },
  });
}
