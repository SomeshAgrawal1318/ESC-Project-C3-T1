import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // mongodb-memory-server downloads a real mongod binary the first time
    // it runs, and PDF page rendering isn't instant either - the default
    // 5s timeout is too tight for both.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
