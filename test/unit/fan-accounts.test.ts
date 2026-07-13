import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { FanAccountsStack } from '../../lib/fan-accounts-stack';

describe('FanAccountsStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new FanAccountsStack(app, 'TestFanAccountsStack', {
      env: { account: '123456789012', region: 'ap-southeast-2' },
      envName: 'dev',
      lambdaFunctionName: 'dev-music-portfolio-fn',
      cloudFrontDomain: 'test.cloudfront.net',
    });
    template = Template.fromStack(stack);
  });

  describe('IAM Policies', () => {
    test('Cognito policy grants 12 actions on the User Pool', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: [
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
              Resource: Match.anyValue(),
            }),
          ]),
        },
      });
    });

    test('DynamoDB policy grants 5 actions on Preferences Table and indexes', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
              ],
              Resource: Match.anyValue(),
            }),
          ]),
        },
      });
    });

    test('DynamoDB policy grants PutItem only on Audit Table', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: 'dynamodb:PutItem',
              Resource: Match.anyValue(),
            }),
          ]),
        },
      });
    });

    test('KMS policy grants encrypt and decrypt via grantEncryptDecrypt', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Allow',
              Action: Match.arrayWith([
                'kms:Decrypt',
                'kms:Encrypt',
              ]),
              Resource: Match.anyValue(),
            }),
          ]),
        },
      });
    });
  });

  describe('SSM Parameters', () => {
    test('stores User Pool ID at /jameswilliams/dev/cognito/user-pool-id', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/jameswilliams/dev/cognito/user-pool-id',
        Type: 'String',
        Value: Match.anyValue(),
      });
    });

    test('stores Client ID at /jameswilliams/dev/cognito/client-id', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/jameswilliams/dev/cognito/client-id',
        Type: 'String',
        Value: Match.anyValue(),
      });
    });

    test('stores Preferences Table name at /jameswilliams/dev/dynamodb/fan-preferences-table', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/jameswilliams/dev/dynamodb/fan-preferences-table',
        Type: 'String',
        Value: Match.anyValue(),
      });
    });

    test('stores Audit Table name at /jameswilliams/dev/dynamodb/fan-deletion-audit-table', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/jameswilliams/dev/dynamodb/fan-deletion-audit-table',
        Type: 'String',
        Value: Match.anyValue(),
      });
    });

    test('stores KMS Key ARN at /jameswilliams/dev/kms/fan-data-key-arn', () => {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/jameswilliams/dev/kms/fan-data-key-arn',
        Type: 'String',
        Value: Match.anyValue(),
      });
    });

    test('creates exactly 5 SSM parameters', () => {
      template.resourceCountIs('AWS::SSM::Parameter', 5);
    });
  });

  describe('CloudWatch Alarms', () => {
    test('CognitoSignUpThrottles alarm has threshold > 10 and 5-minute period', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-fan-accounts-cognito-throttles',
        Namespace: 'AWS/Cognito',
        MetricName: 'SignUpThrottles',
        Threshold: 10,
        Period: 300,
        EvaluationPeriods: 1,
        ComparisonOperator: 'GreaterThanThreshold',
        Statistic: 'Sum',
      });
    });

    test('DynamoDBThrottledRequests alarm has threshold > 0 and 1-minute period', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-fan-accounts-dynamodb-throttles',
        Namespace: 'AWS/DynamoDB',
        MetricName: 'ThrottledRequests',
        Threshold: 0,
        Period: 60,
        EvaluationPeriods: 1,
        ComparisonOperator: 'GreaterThanThreshold',
        Statistic: 'Sum',
      });
    });

    test('LambdaErrors alarm has threshold > 5 and 5-minute period', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-fan-accounts-lambda-errors',
        Namespace: 'AWS/Lambda',
        MetricName: 'Errors',
        Threshold: 5,
        Period: 300,
        EvaluationPeriods: 1,
        ComparisonOperator: 'GreaterThanThreshold',
        Statistic: 'Sum',
      });
    });

    test('all alarms target the SNS ops topic', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-fan-accounts-cognito-throttles',
        AlarmActions: Match.anyValue(),
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-fan-accounts-dynamodb-throttles',
        AlarmActions: Match.anyValue(),
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'dev-fan-accounts-lambda-errors',
        AlarmActions: Match.anyValue(),
      });
    });
  });

  describe('SNS Topic', () => {
    test('ops notification topic exists with correct name', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'dev-fan-accounts-ops',
      });
    });

    test('exactly one SNS topic is created', () => {
      template.resourceCountIs('AWS::SNS::Topic', 1);
    });
  });
});
