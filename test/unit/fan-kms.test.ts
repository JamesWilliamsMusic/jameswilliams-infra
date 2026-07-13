import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FanKmsConstruct } from '../../lib/constructs/fan-kms';

describe('FanKmsConstruct', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new FanKmsConstruct(stack, 'TestKms', { envName: 'dev' });
    template = Template.fromStack(stack);
  });

  test('KMS key alias matches alias/{env}-jameswilliams-fan-data', () => {
    template.hasResourceProperties('AWS::KMS::Alias', {
      AliasName: 'alias/dev-jameswilliams-fan-data',
    });
  });

  test('key rotation is enabled', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
    });
  });

  test('removal policy is RETAIN', () => {
    template.hasResource('AWS::KMS::Key', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });
});
