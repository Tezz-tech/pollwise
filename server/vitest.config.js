import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    // The first MongoDB binary download can take minutes on a cold machine.
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
