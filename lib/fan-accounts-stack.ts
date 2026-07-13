import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { FanKmsConstruct } from './constructs/fan-kms';
import { FanCognitoConstruct } from './constructs/fan-cognito';
import { FanDynamoDBConstruct } from './constructs/fan-dynamodb';

export interface FanAccountsStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
  lambdaFunctionName: string;
  cloudFrontDomain: string;
}

export class FanAccountsStack extends cdk.Stack {
  public readonly kmsConstruct: FanKmsConstruct;
  public readonly cognitoConstruct: FanCognitoConstruct;
  public readonly dynamoConstruct: FanDynamoDBConstruct;

  constructor(scope: Construct, id: string, props: FanAccountsStackProps) {
    super(scope, id, props);

    // KMS key for encrypting fan PII data
    this.kmsConstruct = new FanKmsConstruct(this, 'FanKms', {
      envName: props.envName,
    });

    // Cognito User Pool and App Client for fan authentication
    this.cognitoConstruct = new FanCognitoConstruct(this, 'FanCognito', {
      envName: props.envName,
      cloudFrontDomain: props.cloudFrontDomain,
    });

    // DynamoDB tables for fan preferences and deletion audit
    this.dynamoConstruct = new FanDynamoDBConstruct(this, 'FanDynamoDB', {
      envName: props.envName,
      kmsKey: this.kmsConstruct.key,
    });

    // --- IAM Policies for Lambda execution role ---

    // Import the Lambda role ARN from the InfraStack
    const lambdaRoleArn = cdk.Fn.importValue(
      `${props.envName}-music-portfolio-lambda-role-arn`
    );
    const lambdaRole = iam.Role.fromRoleArn(this, 'LambdaRole', lambdaRoleArn);

    // Grant Cognito operations on the Fan User Pool
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:InitiateAuth',
        'cognito-idp:SignUp',
        'cognito-idp:ConfirmSignUp',
        'cognito-idp:ResendConfirmationCode',
        'cognito-idp:ForgotPassword',
        'cognito-idp:ConfirmForgotPassword',
        'cognito-idp:GetUser',
        'cognito-idp:ChangePassword',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminGetUser',
        'cognito-idp:GlobalSignOut',
        'cognito-idp:RevokeToken',
      ],
      resources: [this.cognitoConstruct.userPool.userPoolArn],
    }));

    // Grant DynamoDB operations on the Preferences Table and its indexes
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
      ],
      resources: [
        this.dynamoConstruct.preferencesTable.tableArn,
        `${this.dynamoConstruct.preferencesTable.tableArn}/index/*`,
      ],
    }));

    // Grant DynamoDB PutItem on the Audit Table only
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [this.dynamoConstruct.auditTable.tableArn],
    }));

    // Grant KMS encrypt, decrypt, generateDataKey on the Fan KMS key
    this.kmsConstruct.key.grantEncryptDecrypt(lambdaRole);

    // --- SSM Parameters for resource discovery ---

    new ssm.StringParameter(this, 'UserPoolIdParam', {
      parameterName: `/jameswilliams/${props.envName}/cognito/user-pool-id`,
      stringValue: this.cognitoConstruct.userPool.userPoolId,
      description: 'Cognito User Pool ID for fan accounts',
    });

    new ssm.StringParameter(this, 'ClientIdParam', {
      parameterName: `/jameswilliams/${props.envName}/cognito/client-id`,
      stringValue: this.cognitoConstruct.userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID for fan accounts',
    });

    new ssm.StringParameter(this, 'PreferencesTableParam', {
      parameterName: `/jameswilliams/${props.envName}/dynamodb/fan-preferences-table`,
      stringValue: this.dynamoConstruct.preferencesTable.tableName,
      description: 'DynamoDB fan preferences table name',
    });

    new ssm.StringParameter(this, 'AuditTableParam', {
      parameterName: `/jameswilliams/${props.envName}/dynamodb/fan-deletion-audit-table`,
      stringValue: this.dynamoConstruct.auditTable.tableName,
      description: 'DynamoDB fan deletion audit table name',
    });

    new ssm.StringParameter(this, 'KmsKeyArnParam', {
      parameterName: `/jameswilliams/${props.envName}/kms/fan-data-key-arn`,
      stringValue: this.kmsConstruct.key.keyArn,
      description: 'KMS key ARN for fan data encryption',
    });

    // --- CloudWatch Alarms and SNS Topic ---

    // SNS topic for operational notifications
    const opsTopic = new sns.Topic(this, 'OpsNotificationTopic', {
      topicName: `${props.envName}-fan-accounts-ops`,
    });

    // Cognito SignUpThrottles alarm: threshold > 10 in 5-minute period
    const cognitoThrottlesAlarm = new cloudwatch.Alarm(this, 'CognitoSignUpThrottlesAlarm', {
      alarmName: `${props.envName}-fan-accounts-cognito-throttles`,
      alarmDescription: 'Cognito sign-up throttle count exceeds 10 within 5 minutes',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Cognito',
        metricName: 'SignUpThrottles',
        dimensionsMap: {
          UserPool: this.cognitoConstruct.userPool.userPoolId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cognitoThrottlesAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(opsTopic));

    // DynamoDB ThrottledRequests alarm: threshold > 0 in 1-minute period
    const dynamoThrottlesAlarm = new cloudwatch.Alarm(this, 'DynamoDBThrottledRequestsAlarm', {
      alarmName: `${props.envName}-fan-accounts-dynamodb-throttles`,
      alarmDescription: 'DynamoDB throttled request count exceeds 0 within 1 minute',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        dimensionsMap: {
          TableName: this.dynamoConstruct.preferencesTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dynamoThrottlesAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(opsTopic));

    // Lambda Errors alarm: threshold > 5 in 5-minute period
    const lambdaErrorsAlarm = new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
      alarmName: `${props.envName}-fan-accounts-lambda-errors`,
      alarmDescription: 'Lambda error count exceeds 5 within 5 minutes',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: {
          FunctionName: props.lambdaFunctionName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaErrorsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(opsTopic));
  }
}
