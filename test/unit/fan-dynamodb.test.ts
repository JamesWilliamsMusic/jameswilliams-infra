import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Template } from 'aws-cdk-lib/assertions';
import { FanDynamoDBConstruct } from '../../lib/constructs/fan-dynamodb';

describe('FanDynamoDBConstruct', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const key = new kms.Key(stack, 'TestKey');
    new FanDynamoDBConstruct(stack, 'TestDynamo', {
      envName: 'dev',
      kmsKey: key,
    });
    template = Template.fromStack(stack);
  });

  describe('Preferences Table', () => {
    test('table name is dev-jameswilliams-fan-preferences', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-preferences',
      });
    });

    test('partition key is fanId (String)', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-preferences',
        KeySchema: [{ AttributeName: 'fanId', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'fanId', AttributeType: 'S' },
          { AttributeName: 'email', AttributeType: 'S' },
        ],
      });
    });

    test('GSI email-index exists with email as partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-preferences',
        GlobalSecondaryIndexes: [
          {
            IndexName: 'email-index',
            KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
          },
        ],
      });
    });

    test('billing mode is PAY_PER_REQUEST', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-preferences',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('Point-In-Time Recovery is enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-preferences',
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      });
    });

    test('encryption uses customer-managed KMS key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-preferences',
        SSESpecification: {
          KMSMasterKeyId: { 'Fn::GetAtt': ['TestKey4CACAF33', 'Arn'] },
          SSEEnabled: true,
          SSEType: 'KMS',
        },
      });
    });
  });

  describe('Audit Table', () => {
    test('table name is dev-jameswilliams-fan-deletion-audit', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-deletion-audit',
      });
    });

    test('partition key is auditId (String)', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-deletion-audit',
        KeySchema: [{ AttributeName: 'auditId', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'auditId', AttributeType: 'S' },
        ],
      });
    });

    test('TTL attribute is expiresAt', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-deletion-audit',
        TimeToLiveSpecification: {
          AttributeName: 'expiresAt',
          Enabled: true,
        },
      });
    });

    test('billing mode is PAY_PER_REQUEST', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-deletion-audit',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('Point-In-Time Recovery is enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-deletion-audit',
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      });
    });

    test('encryption uses customer-managed KMS key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'dev-jameswilliams-fan-deletion-audit',
        SSESpecification: {
          KMSMasterKeyId: { 'Fn::GetAtt': ['TestKey4CACAF33', 'Arn'] },
          SSEEnabled: true,
          SSEType: 'KMS',
        },
      });
    });
  });
});
