/**
 * Jest config for the CENTCOM repo.
 *
 * Scope: unit tests for pure modules under lib/. We intentionally do NOT use
 * `next/jest` (which spins up the Next.js compiler) because the only thing
 * worth testing today is the reporting engine — a tree of pure functions
 * that don't need Next's webpack pipeline. ts-jest is faster, simpler, and
 * keeps the test config from drifting with Next versions.
 *
 * Run: `npm test` · `npm run test:watch` · `npm run test:ci`
 */
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/lib/**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // The repo's tsconfig is geared for the Next.js compiler; ts-jest needs
  // a couple of overrides to type-check + transpile a plain Node target.
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2020',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          jsx: 'react-jsx',
          strict: true,
          isolatedModules: true,
          allowJs: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          paths: { '@/*': ['./*'] },
        },
      },
    ],
  },
  // Engine paths are pure functions — coverage is meaningful.
  collectCoverageFrom: [
    'lib/reporting/engine.ts',
    'lib/reporting/external-facts.ts',
  ],
  coverageThreshold: {
    'lib/reporting/engine.ts': {
      branches: 60,
      functions: 80,
      lines: 75,
      statements: 75,
    },
  },
}

export default config
