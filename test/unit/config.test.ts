import * as cdk from 'aws-cdk-lib';
import { loadEnvironmentConfig } from '../../lib/config';

describe('loadEnvironmentConfig', () => {
  test('loads dev environment config from context', () => {
    const app = new cdk.App({
      context: {
        dev: {
          account: '123456789012',
          region: 'us-east-1',
          domainName: 'example.com',
          subDomain: 'dev',
          lambdaMemorySize: 512,
          lambdaTimeout: 30,
        },
      },
    });

    const config = loadEnvironmentConfig(app, 'dev');

    expect(config.envName).toBe('dev');
    expect(config.account).toBe('123456789012');
    expect(config.region).toBe('us-east-1');
    expect(config.domainName).toBe('example.com');
    expect(config.subDomain).toBe('dev');
    expect(config.lambdaMemorySize).toBe(512);
    expect(config.lambdaTimeout).toBe(30);
  });

  test('loads prod environment config without domainName', () => {
    const app = new cdk.App({
      context: {
        prod: {
          account: '987654321098',
          region: 'us-east-1',
          lambdaMemorySize: 1024,
          lambdaTimeout: 60,
        },
      },
    });

    const config = loadEnvironmentConfig(app, 'prod');

    expect(config.envName).toBe('prod');
    expect(config.account).toBe('987654321098');
    expect(config.domainName).toBeUndefined();
    expect(config.subDomain).toBeUndefined();
    expect(config.lambdaMemorySize).toBe(1024);
    expect(config.lambdaTimeout).toBe(60);
  });

  test('throws error when environment context is missing', () => {
    const app = new cdk.App({ context: {} });

    expect(() => loadEnvironmentConfig(app, 'dev')).toThrow(
      'Missing CDK context for environment "dev"'
    );
  });

  test('throws error when required fields are missing', () => {
    const app = new cdk.App({
      context: {
        dev: {
          account: '123456789012',
        },
      },
    });

    expect(() => loadEnvironmentConfig(app, 'dev')).toThrow(
      'Missing required configuration fields for "dev" environment: region, lambdaMemorySize, lambdaTimeout'
    );
  });
});
