import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
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

describe('API Gateway HTTP API', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new InfraStack(app, 'TestStack', {
      env: { account: devConfig.account, region: devConfig.region },
      config: devConfig,
    });
    template = Template.fromStack(stack);
  });

  test('HTTP API exists in synthesized template', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      Name: 'dev-music-portfolio-api',
      ProtocolType: 'HTTP',
    });
  });

  test('default route is integrated with Lambda function', () => {
    // Verify a route with $default path exists
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$default',
    });

    // Verify Lambda integration exists
    template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'AWS_PROXY',
      PayloadFormatVersion: '2.0',
    });
  });

  test('per-environment stage is configured', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: 'dev',
      AutoDeploy: true,
    });
  });
});
