import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface WebinyDeployRoleStackProps extends cdk.StackProps {
  /**
   * GitHub repo that runs Webiny deployments (e.g., "JamesWilliamsMusic/jameswilliams-webiny")
   */
  webinyRepo: string;

  /**
   * The OIDC provider ARN for GitHub Actions.
   * If not provided, it will be derived from the account.
   */
  oidcProviderArn?: string;

  /**
   * Environment name prefix for resource naming (e.g., "dev", "prod")
   */
  envName?: string;
}

/**
 * Creates an IAM role with the permissions required for Webiny CMS deployment.
 *
 * Webiny uses Pulumi under the hood and provisions:
 * - DynamoDB tables
 * - S3 buckets
 * - Lambda functions
 * - API Gateway (REST & WebSocket)
 * - CloudFront distributions
 * - Cognito user pools
 * - EventBridge rules
 * - SQS queues
 * - OpenSearch/Elasticsearch domains
 * - Step Functions state machines
 * - CloudWatch Logs
 * - IAM roles and policies (for its own resources)
 * - CloudFormation stacks (Pulumi backend)
 * - ACM certificates
 * - WAF web ACLs
 */
export class WebinyDeployRoleStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: WebinyDeployRoleStackProps) {
    super(scope, id, props);

    const { webinyRepo, envName = '' } = props;
    const prefix = envName ? `${envName}-` : '';

    const oidcProviderArn = props.oidcProviderArn ??
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`;

    // Import the OIDC provider created by GitHubOidcBootstrap stack
    const oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidcProvider',
      oidcProviderArn
    );

    // Create the deployment role for Webiny
    this.deployRole = new iam.Role(this, 'WebinyDeployRole', {
      roleName: `${prefix}github-actions-webiny-deploy`,
      assumedBy: new iam.WebIdentityPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${webinyRepo}:*`,
          },
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
        }
      ),
      description: `Role for Webiny CMS deployment via GitHub Actions (${webinyRepo})`,
      maxSessionDuration: cdk.Duration.hours(2),
    });

    // --- Pulumi State Management (S3 + DynamoDB) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'PulumiStateS3',
      effect: iam.Effect.ALLOW,
      actions: [
        's3:CreateBucket',
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
        's3:GetBucketLocation',
        's3:GetBucketPolicy',
        's3:PutBucketPolicy',
        's3:PutBucketVersioning',
        's3:PutBucketEncryption',
        's3:PutBucketPublicAccessBlock',
        's3:GetBucketPublicAccessBlock',
        's3:PutBucketCORS',
        's3:GetBucketCORS',
        's3:DeleteBucketCORS',
        's3:PutBucketNotification',
        's3:GetBucketNotification',
        's3:PutBucketTagging',
        's3:GetBucketTagging',
        's3:PutLifecycleConfiguration',
        's3:GetLifecycleConfiguration',
        's3:PutBucketAcl',
        's3:GetBucketAcl',
        's3:DeleteBucket',
      ],
      resources: ['*'],
    }));

    // --- DynamoDB (Webiny data layer) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoDB',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:CreateTable',
        'dynamodb:DeleteTable',
        'dynamodb:DescribeTable',
        'dynamodb:UpdateTable',
        'dynamodb:ListTables',
        'dynamodb:TagResource',
        'dynamodb:UntagResource',
        'dynamodb:ListTagsOfResource',
        'dynamodb:DescribeTimeToLive',
        'dynamodb:UpdateTimeToLive',
        'dynamodb:DescribeContinuousBackups',
        'dynamodb:UpdateContinuousBackups',
      ],
      resources: ['*'],
    }));

    // --- Lambda ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'Lambda',
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:CreateFunction',
        'lambda:DeleteFunction',
        'lambda:GetFunction',
        'lambda:GetFunctionConfiguration',
        'lambda:UpdateFunctionCode',
        'lambda:UpdateFunctionConfiguration',
        'lambda:ListFunctions',
        'lambda:ListVersionsByFunction',
        'lambda:PublishVersion',
        'lambda:CreateAlias',
        'lambda:DeleteAlias',
        'lambda:GetAlias',
        'lambda:UpdateAlias',
        'lambda:AddPermission',
        'lambda:RemovePermission',
        'lambda:GetPolicy',
        'lambda:InvokeFunction',
        'lambda:TagResource',
        'lambda:UntagResource',
        'lambda:ListTags',
        'lambda:PutFunctionEventInvokeConfig',
        'lambda:GetFunctionEventInvokeConfig',
        'lambda:DeleteFunctionEventInvokeConfig',
        'lambda:PutFunctionConcurrency',
        'lambda:DeleteFunctionConcurrency',
        'lambda:CreateEventSourceMapping',
        'lambda:DeleteEventSourceMapping',
        'lambda:GetEventSourceMapping',
        'lambda:UpdateEventSourceMapping',
        'lambda:ListEventSourceMappings',
        'lambda:GetLayerVersion',
        'lambda:PublishLayerVersion',
        'lambda:DeleteLayerVersion',
        'lambda:ListLayers',
      ],
      resources: ['*'],
    }));

    // --- API Gateway (REST + HTTP + WebSocket) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ApiGateway',
      effect: iam.Effect.ALLOW,
      actions: [
        'apigateway:*',
      ],
      resources: ['*'],
    }));

    // --- CloudFront ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudFront',
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudfront:CreateDistribution',
        'cloudfront:UpdateDistribution',
        'cloudfront:DeleteDistribution',
        'cloudfront:GetDistribution',
        'cloudfront:GetDistributionConfig',
        'cloudfront:ListDistributions',
        'cloudfront:TagResource',
        'cloudfront:UntagResource',
        'cloudfront:ListTagsForResource',
        'cloudfront:CreateInvalidation',
        'cloudfront:CreateOriginAccessControl',
        'cloudfront:DeleteOriginAccessControl',
        'cloudfront:GetOriginAccessControl',
        'cloudfront:UpdateOriginAccessControl',
        'cloudfront:ListOriginAccessControls',
        'cloudfront:CreateFunction',
        'cloudfront:UpdateFunction',
        'cloudfront:DeleteFunction',
        'cloudfront:DescribeFunction',
        'cloudfront:PublishFunction',
        'cloudfront:GetFunction',
        'cloudfront:ListFunctions',
        'cloudfront:CreateCachePolicy',
        'cloudfront:UpdateCachePolicy',
        'cloudfront:DeleteCachePolicy',
        'cloudfront:GetCachePolicy',
        'cloudfront:ListCachePolicies',
        'cloudfront:CreateOriginRequestPolicy',
        'cloudfront:UpdateOriginRequestPolicy',
        'cloudfront:DeleteOriginRequestPolicy',
        'cloudfront:GetOriginRequestPolicy',
        'cloudfront:ListOriginRequestPolicies',
        'cloudfront:CreateResponseHeadersPolicy',
        'cloudfront:UpdateResponseHeadersPolicy',
        'cloudfront:DeleteResponseHeadersPolicy',
        'cloudfront:GetResponseHeadersPolicy',
        'cloudfront:ListResponseHeadersPolicies',
      ],
      resources: ['*'],
    }));

    // --- Cognito ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'Cognito',
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:*',
        'cognito-identity:*',
      ],
      resources: ['*'],
    }));

    // --- IAM (for Webiny to create its own service roles) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'IAM',
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:GetRole',
        'iam:UpdateRole',
        'iam:PassRole',
        'iam:ListRolePolicies',
        'iam:ListAttachedRolePolicies',
        'iam:AttachRolePolicy',
        'iam:DetachRolePolicy',
        'iam:PutRolePolicy',
        'iam:GetRolePolicy',
        'iam:DeleteRolePolicy',
        'iam:TagRole',
        'iam:UntagRole',
        'iam:CreatePolicy',
        'iam:DeletePolicy',
        'iam:GetPolicy',
        'iam:GetPolicyVersion',
        'iam:ListPolicyVersions',
        'iam:CreatePolicyVersion',
        'iam:DeletePolicyVersion',
        'iam:ListEntitiesForPolicy',
        'iam:CreateInstanceProfile',
        'iam:DeleteInstanceProfile',
        'iam:GetInstanceProfile',
        'iam:AddRoleToInstanceProfile',
        'iam:RemoveRoleFromInstanceProfile',
      ],
      resources: ['*'],
    }));

    // --- CloudWatch Logs ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogs',
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:DeleteLogGroup',
        'logs:DescribeLogGroups',
        'logs:PutRetentionPolicy',
        'logs:DeleteRetentionPolicy',
        'logs:TagLogGroup',
        'logs:UntagLogGroup',
        'logs:TagResource',
        'logs:UntagResource',
        'logs:ListTagsForResource',
        'logs:ListTagsLogGroup',
      ],
      resources: ['*'],
    }));

    // --- EventBridge ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EventBridge',
      effect: iam.Effect.ALLOW,
      actions: [
        'events:CreateEventBus',
        'events:DeleteEventBus',
        'events:DescribeEventBus',
        'events:PutRule',
        'events:DeleteRule',
        'events:DescribeRule',
        'events:EnableRule',
        'events:DisableRule',
        'events:ListRules',
        'events:PutTargets',
        'events:RemoveTargets',
        'events:ListTargetsByRule',
        'events:TagResource',
        'events:UntagResource',
      ],
      resources: ['*'],
    }));

    // --- SQS ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SQS',
      effect: iam.Effect.ALLOW,
      actions: [
        'sqs:CreateQueue',
        'sqs:DeleteQueue',
        'sqs:GetQueueAttributes',
        'sqs:SetQueueAttributes',
        'sqs:GetQueueUrl',
        'sqs:ListQueues',
        'sqs:TagQueue',
        'sqs:UntagQueue',
        'sqs:ListQueueTags',
      ],
      resources: ['*'],
    }));

    // --- OpenSearch (used by Webiny for search/indexing) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'OpenSearch',
      effect: iam.Effect.ALLOW,
      actions: [
        'es:CreateDomain',
        'es:DeleteDomain',
        'es:DescribeDomain',
        'es:DescribeDomainConfig',
        'es:UpdateDomainConfig',
        'es:ListDomainNames',
        'es:ListTags',
        'es:AddTags',
        'es:RemoveTags',
        'es:GetCompatibleVersions',
        'es:UpgradeDomain',
      ],
      resources: ['*'],
    }));

    // --- Step Functions ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'StepFunctions',
      effect: iam.Effect.ALLOW,
      actions: [
        'states:CreateStateMachine',
        'states:DeleteStateMachine',
        'states:DescribeStateMachine',
        'states:UpdateStateMachine',
        'states:ListStateMachines',
        'states:TagResource',
        'states:UntagResource',
        'states:ListTagsForResource',
      ],
      resources: ['*'],
    }));

    // --- ACM (certificates) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ACM',
      effect: iam.Effect.ALLOW,
      actions: [
        'acm:RequestCertificate',
        'acm:DescribeCertificate',
        'acm:ListCertificates',
        'acm:DeleteCertificate',
        'acm:AddTagsToCertificate',
        'acm:ListTagsForCertificate',
      ],
      resources: ['*'],
    }));

    // --- CloudFormation (Pulumi uses CF under the hood for some operations) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudFormation',
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudformation:CreateStack',
        'cloudformation:UpdateStack',
        'cloudformation:DeleteStack',
        'cloudformation:DescribeStacks',
        'cloudformation:DescribeStackEvents',
        'cloudformation:GetTemplate',
        'cloudformation:ListStacks',
        'cloudformation:ListStackResources',
      ],
      resources: ['*'],
    }));

    // --- WAF (Web Application Firewall) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'WAF',
      effect: iam.Effect.ALLOW,
      actions: [
        'wafv2:CreateWebACL',
        'wafv2:DeleteWebACL',
        'wafv2:GetWebACL',
        'wafv2:UpdateWebACL',
        'wafv2:ListWebACLs',
        'wafv2:AssociateWebACL',
        'wafv2:DisassociateWebACL',
        'wafv2:TagResource',
        'wafv2:UntagResource',
        'wafv2:ListTagsForResource',
      ],
      resources: ['*'],
    }));

    // --- STS (for assume role chaining if needed) ---
    this.deployRole.addToPolicy(new iam.PolicyStatement({
      sid: 'STS',
      effect: iam.Effect.ALLOW,
      actions: [
        'sts:GetCallerIdentity',
      ],
      resources: ['*'],
    }));

    // Outputs
    new cdk.CfnOutput(this, 'WebinyDeployRoleArn', {
      value: this.deployRole.roleArn,
      description: `Add this as AWS_ROLE_ARN in ${webinyRepo} GitHub repo secrets`,
      exportName: `${prefix}WebinyDeployRoleArn`,
    });
  }
}
