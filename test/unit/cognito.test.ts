import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../../lib/infra-stack';
import { EnvironmentConfig } from '../../lib/config';

const devConfig: EnvironmentConfig = {
  envName: 'dev',
  account: '123456789012',
  region: 'us-east-1',
  domainName: 'example.com',
  subDomain: 'dev',
  lambdaMemorySize: 512,
  lambdaTimeout: 30,
};

describe('Cognito User Pool', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new InfraStack(app, 'TestStack', {
      env: { account: devConfig.account, region: devConfig.region },
      config: devConfig,
    });
    template = Template.fromStack(stack);
  });

  test('Cognito user pool exists', () => {
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
  });

  test('password policy minimum length is 8', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
        },
      },
    });
  });

  test('app client is created', () => {
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
  });
});
