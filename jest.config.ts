import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test/unit', '<rootDir>/test/property'],
  testMatch: ['**/*.test.ts', '**/*.property.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};

export default config;
