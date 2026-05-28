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

const prodConfig: EnvironmentConfig = {
  envName: 'prod',
  account: '987654321098',
  region: 'us-east-1',
  domainName: 'example.com',
  lambdaMemorySize: 1024,
  lambdaTimeout: 60,
};

describe('DNS and ACM Resources', () => {
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

    test('Route 53 hosted zone exists', () => {
      template.resourceCountIs('AWS::Route53::HostedZone', 1);
      template.hasResourceProperties('AWS::Route53::HostedZone', {
        Name: 'example.com.',
      });
    });

    test('A record alias points to CloudFront', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Type: 'A',
        AliasTarget: Match.objectLike({
          DNSName: Match.anyValue(),
          HostedZoneId: Match.anyValue(),
        }),
      });
    });

    test('ACM certificate uses DNS validation', () => {
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        ValidationMethod: 'DNS',
      });
    });

    test('dev uses subdomain in DNS record', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'dev.example.com.',
      });
    });

    test('dev ACM certificate uses subdomain', () => {
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'dev.example.com',
      });
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

    test('prod uses apex domain in DNS record', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'example.com.',
      });
    });

    test('prod ACM certificate uses apex domain with www SAN', () => {
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'example.com',
        SubjectAlternativeNames: ['www.example.com'],
      });
    });
  });
});
