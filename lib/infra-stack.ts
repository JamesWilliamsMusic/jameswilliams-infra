import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface InfraStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class InfraStack extends cdk.Stack {
  public readonly repository: ecr.Repository;
  public readonly lambdaFunction: lambda.DockerImageFunction;
  public readonly httpApi: apigw.HttpApi;
  public readonly distribution: cloudfront.Distribution;
  public readonly userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const { config } = props;
    const prefix = `${config.envName}-music-portfolio`;

    // --- ECR Repository (for CI pushes) ---
    this.repository = new ecr.Repository(this, 'EcrRepository', {
      repositoryName: prefix,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Retain only the 10 most recent images',
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Grant Lambda service pull access on the ECR repo
    this.repository.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
      actions: [
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
      ],
    }));

    // --- Lambda Function ---
    // Uses a placeholder image built from ./placeholder/ on first deploy.
    // CI will update the function code to the real app image later.
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Allow the Lambda role to pull images from ECR
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:GetAuthorizationToken',
      ],
      resources: ['*'],
    }));

    this.lambdaFunction = new lambda.DockerImageFunction(this, 'LambdaFunction', {
      functionName: `${prefix}-fn`,
      code: lambda.DockerImageCode.fromImageAsset(
        path.join(__dirname, '..', 'placeholder'),
        { platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64 }
      ),
      memorySize: config.lambdaMemorySize,
      timeout: cdk.Duration.seconds(config.lambdaTimeout),
      role: lambdaRole,
      environment: {
        NODE_ENV: config.envName === 'prod' ? 'production' : 'development',
        WEBINY_API_URL: '',
        WEBINY_API_TOKEN: '',
      },
    });

    // --- API Gateway HTTP API ---
    const lambdaIntegration = new apigwIntegrations.HttpLambdaIntegration(
      'LambdaIntegration',
      this.lambdaFunction
    );

    this.httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: `${prefix}-api`,
      defaultIntegration: lambdaIntegration,
    });

    // --- CloudFront Distribution (no custom domain for now) ---
    const apiEndpointDomain = `${this.httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`;

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(apiEndpointDomain),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      comment: `${prefix} distribution`,
    });

    // --- Fan Accounts Lambda Environment Variables ---
    // Values sourced from FanAccountsStack SSM parameters (resolved at deploy time)
    const cognitoUserPoolId = ssm.StringParameter.valueForStringParameter(
      this, `/jameswilliams/${config.envName}/cognito/user-pool-id`
    );
    const cognitoClientId = ssm.StringParameter.valueForStringParameter(
      this, `/jameswilliams/${config.envName}/cognito/client-id`
    );
    const fanPreferencesTable = ssm.StringParameter.valueForStringParameter(
      this, `/jameswilliams/${config.envName}/dynamodb/fan-preferences-table`
    );
    const fanDeletionAuditTable = ssm.StringParameter.valueForStringParameter(
      this, `/jameswilliams/${config.envName}/dynamodb/fan-deletion-audit-table`
    );
    const kmsKeyArn = ssm.StringParameter.valueForStringParameter(
      this, `/jameswilliams/${config.envName}/kms/fan-data-key-arn`
    );

    this.lambdaFunction.addEnvironment('COGNITO_USER_POOL_ID', cognitoUserPoolId);
    this.lambdaFunction.addEnvironment('COGNITO_CLIENT_ID', cognitoClientId);
    this.lambdaFunction.addEnvironment('COGNITO_REGION', 'ap-southeast-2');
    this.lambdaFunction.addEnvironment('FAN_PREFERENCES_TABLE', fanPreferencesTable);
    this.lambdaFunction.addEnvironment('FAN_DELETION_AUDIT_TABLE', fanDeletionAuditTable);
    this.lambdaFunction.addEnvironment('KMS_KEY_ARN', kmsKeyArn);
    this.lambdaFunction.addEnvironment('COOKIE_DOMAIN', this.distribution.distributionDomainName);
    this.lambdaFunction.addEnvironment('COOKIE_SECURE', 'true');
    this.lambdaFunction.addEnvironment('NEXT_PUBLIC_APP_URL', `https://${this.distribution.distributionDomainName}`);

    // --- Cognito User Pool ---
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-users`,
      passwordPolicy: {
        minLength: 8,
      },
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${prefix}-app-client`,
      authFlows: {
        userSrp: true,
      },
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: `https://${apiEndpointDomain}`,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: this.lambdaFunction.functionName,
      description: 'Lambda function name (use in web app CI)',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR repository URI (use in web app CI)',
    });

    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: lambdaRole.roleArn,
      exportName: `${prefix}-lambda-role-arn`,
    });
  }
}
