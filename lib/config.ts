import { App } from 'aws-cdk-lib';

export interface EnvironmentConfig {
  envName: 'dev' | 'prod';
  account: string;
  region: string;
  domainName?: string;
  subDomain?: string;
  lambdaMemorySize: number;
  lambdaTimeout: number;
}

/**
 * Load environment configuration from CDK context.
 * Throws a descriptive error if required values are missing.
 */
export function loadEnvironmentConfig(app: App, envName: 'dev' | 'prod'): EnvironmentConfig {
  const context = app.node.tryGetContext(envName);

  if (!context) {
    throw new Error(
      `Missing CDK context for environment "${envName}". ` +
      `Ensure "${envName}" is defined in cdk.json context.`
    );
  }

  const requiredFields: (keyof Omit<EnvironmentConfig, 'envName' | 'subDomain' | 'domainName'>)[] = [
    'account',
    'region',
    'lambdaMemorySize',
    'lambdaTimeout',
  ];

  const missingFields = requiredFields.filter((field) => context[field] === undefined);

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required configuration fields for "${envName}" environment: ${missingFields.join(', ')}. ` +
      `Please add these values to the "${envName}" context in cdk.json.`
    );
  }

  return {
    envName,
    account: context.account,
    region: context.region,
    domainName: context.domainName,
    subDomain: context.subDomain,
    lambdaMemorySize: context.lambdaMemorySize,
    lambdaTimeout: context.lambdaTimeout,
  };
}
