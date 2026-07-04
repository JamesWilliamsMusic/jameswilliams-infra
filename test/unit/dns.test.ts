import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { InfraStack } from '../../lib/infra-stack';
import { EnvironmentConfig } from '../../lib/config';

const devConfig: EnvironmentConfig = {
  envName: 'dev',
  account: '123456789012',
  region: 'us-east-1',
  lambdaMemorySize: 512,
  lambdaTimeout: 30,
};

const prodConfig: EnvironmentConfig = {
  envName: 'prod',
  account: '987654321098',
  region: 'us-east-1',
  lambdaMemorySize: 1024,
  lambdaTimeout: 60,
};

describe('CloudFront Distribution (no custom domain)', () => {
  describe('Dev environment', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const stack = new InfraStack(app, 'DevStack', {
        env: { account: devConfig.account, region: devConfig.region },
        config: devConfig,
      });
      template = Template.fromStack(stack);
    });

    test('CloudFront distribution exists', () => {
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    test('no custom domain names are configured', () => {
      // Without a domain, CloudFront should not have Aliases
      const resources = template.findResources('AWS::CloudFront::Distribution');
      const distConfig = Object.values(resources)[0];
      expect(distConfig.Properties.DistributionConfig.Aliases).toBeUndefined();
    });

    test('no Route53 records exist (no domain)', () => {
      template.resourceCountIs('AWS::Route53::HostedZone', 0);
      template.resourceCountIs('AWS::Route53::RecordSet', 0);
    });

    test('no ACM certificates exist (no domain)', () => {
      template.resourceCountIs('AWS::CertificateManager::Certificate', 0);
    });
  });

  describe('Prod environment', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const stack = new InfraStack(app, 'ProdStack', {
        env: { account: prodConfig.account, region: prodConfig.region },
        config: prodConfig,
      });
      template = Template.fromStack(stack);
    });

    test('CloudFront distribution exists without custom domain', () => {
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
      const resources = template.findResources('AWS::CloudFront::Distribution');
      const distConfig = Object.values(resources)[0];
      expect(distConfig.Properties.DistributionConfig.Aliases).toBeUndefined();
    });
  });
});
