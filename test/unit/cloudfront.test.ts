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

  test('API Gateway is configured as origin (not Lambda directly)', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Origins: [
          Match.objectLike({
            CustomOriginConfig: {
              OriginProtocolPolicy: 'https-only',
            },
            OriginPath: '/dev',
          }),
        ],
      },
    });

    // Verify origin domain references execute-api (API Gateway), not Lambda
    const resources = template.findResources('AWS::CloudFront::Distribution');
    const distConfig = Object.values(resources)[0];
    const origin = distConfig.Properties.DistributionConfig.Origins[0];
    const domainParts = origin.DomainName['Fn::Join'][1];
    const domainSuffix = domainParts[1] as string;
    expect(domainSuffix).toContain('.execute-api.');
  });

  test('ACM certificate is attached', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        ViewerCertificate: {
          AcmCertificateArn: Match.anyValue(),
          SslSupportMethod: 'sni-only',
        },
      },
    });
  });

  test('custom domain is configured as alternate domain name (dev)', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['dev.example.com'],
      },
    });
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

  test('custom domain includes apex and www as alternate domain names', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Aliases: ['example.com', 'www.example.com'],
      },
    });
  });
});
