import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface FanDynamoDBConstructProps {
  envName: string;
  kmsKey: kms.Key;
}

export class FanDynamoDBConstruct extends Construct {
  public readonly preferencesTable: dynamodb.Table;
  public readonly auditTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: FanDynamoDBConstructProps) {
    super(scope, id);

    this.preferencesTable = new dynamodb.Table(this, 'FanPreferencesTable', {
      tableName: `${props.envName}-jameswilliams-fan-preferences`,
      partitionKey: { name: 'fanId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
    });

    this.preferencesTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    this.auditTable = new dynamodb.Table(this, 'FanDeletionAuditTable', {
      tableName: `${props.envName}-jameswilliams-fan-deletion-audit`,
      partitionKey: { name: 'auditId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      timeToLiveAttribute: 'expiresAt',
    });
  }
}
