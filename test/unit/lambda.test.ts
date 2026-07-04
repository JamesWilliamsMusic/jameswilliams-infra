import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../../lib/infra-stack';
import { EnvironmentConfig } from '../../lib/config';

const devConfig: EnvironmentConfig = {
  envName: 'dev',
  account: '123456789012',
  region: 'us-east-1',
  lambdaMemorySize: 512,
  lambdaTimeout: 30,
};

describe('Lambda Function', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new InfraStack(app, 'TestStack', {
      env: { account: devConfig.account, region: devConfig.region },
      config: devConfig,
    });
    template = Template.fromStack(stack);
  });

  test('Lambda function exists with Docker image configuration', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      PackageType: 'Image',
    });
  });

  test('memory size matches environment config', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 512,
    });
  });

  test('timeout matches environment config', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 30,
    });
  });

  test('IAM role has ECR pull permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'ecr:GetDownloadUrlForLayer',
              'ecr:BatchGetImage',
              'ecr:GetAuthorizationToken',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('Lambda has environment variables for Webiny', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          NODE_ENV: 'development',
          WEBINY_API_URL: '',
          WEBINY_API_TOKEN: '',
        }),
      },
    });
  });
});
