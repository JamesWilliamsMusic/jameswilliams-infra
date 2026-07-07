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

const prodConfig: EnvironmentConfig = {
  envName: 'prod',
  account: '987654321098',
  region: 'us-east-1',
  lambdaMemorySize: 1024,
  lambdaTimeout: 60,
};

describe('CloudFront Distribution', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new InfraStack(app, 'TestStack', {
      env: { account: devConfig.account, region: devConfig.region },
      config: devConfig,
    });
    template = Template.fromStack(stack);
  });

  test('CloudFront distribution exists', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('API Gateway is configured as origin without path prefix', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Origins: [
          Match.objectLike({
            CustomOriginConfig: {
              OriginProtocolPolicy: 'https-only',
            },
          }),
        ],
      },
    });

    // Verify origin domain references execute-api (API Gateway)
    const resources = template.findResources('AWS::CloudFront::Distribution');
    const distConfig = Object.values(resources)[0];
    const origin = distConfig.Properties.DistributionConfig.Origins[0];
    const domainParts = origin.DomainName['Fn::Join'][1];
    const domainSuffix = domainParts[1] as string;
    expect(domainSuffix).toContain('.execute-api.');
    // No origin path — routes go to root
    expect(origin.OriginPath).toBeUndefined();
  });

  test('uses default CloudFront domain (no custom domain or certificate)', () => {
    const resources = template.findResources('AWS::CloudFront::Distribution');
    const distConfig = Object.values(resources)[0];
    expect(distConfig.Properties.DistributionConfig.Aliases).toBeUndefined();
    expect(distConfig.Properties.DistributionConfig.ViewerCertificate).toBeUndefined();
  });
});

describe('CloudFront Distribution (prod)', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new InfraStack(app, 'ProdStack', {
      env: { account: prodConfig.account, region: prodConfig.region },
      config: prodConfig,
    });
    template = Template.fromStack(stack);
  });

  test('prod origin has no path prefix', () => {
    const resources = template.findResources('AWS::CloudFront::Distribution');
    const distConfig = Object.values(resources)[0];
    const origin = distConfig.Properties.DistributionConfig.Origins[0];
    expect(origin.OriginPath).toBeUndefined();
  });
});
