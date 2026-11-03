import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

# Automated fix for issue #20: MISSING_SCHEMA auto-fix injects a fabricated SoftwareApplication with a free Offer, regardless of page type
