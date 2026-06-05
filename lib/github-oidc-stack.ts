import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GitHubOidcStackProps extends cdk.StackProps {
  /**
   * GitHub org/username and repo name (e.g., "joonochakma/jameswilliams-infra")
   */
  githubRepo: string;

  /**
   * Optional: additional repos that can assume this role
   * (e.g., ["joonochakma/jameswilliams-web", "joonochakma/jameswilliams-api"])
   */
  additionalRepos?: string[];
}

export class GitHubOidcStack extends cdk.Stack {
  public readonly deployRole: iam.Role;
  public readonly oidcProvider: iam.IOpenIdConnectProvider;

  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { githubRepo, additionalRepos = [] } = props;
    const allRepos = [githubRepo, ...additionalRepos];

    // Import the existing OIDC provider (already created in this account)
    this.oidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidcProvider',
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`
    );

    // Build the trust condition: allow all specified repos, any branch
    const repoConditions = allRepos.map((repo) => `repo:${repo}:*`);

    // Create the IAM role that GitHub Actions will assume
    this.deployRole = new iam.Role(this, 'GitHubActionsDeployRole', {
      roleName: 'github-actions-deploy',
      assumedBy: new iam.WebIdentityPrincipal(
        this.oidcProvider.openIdConnectProviderArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub': repoConditions,
          },
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
        }
      ),
      description: 'Role assumed by GitHub Actions via OIDC for CDK deployments',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Grant CDK deployment permissions
    // Using AdministratorAccess for now — scope down once you know exactly what CDK needs
    this.deployRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
    );

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: this.deployRole.roleArn,
      description: 'Add this as AWS_ROLE_ARN in your GitHub repo secrets (infra)',
      exportName: 'GitHubActionsDeployRoleArn',
    });

    // --- Web Repo Role (scoped to ECR push only) ---
    const webRole = new iam.Role(this, 'GitHubActionsWebRole', {
      roleName: 'github-actions-jameswilliams-web',
      assumedBy: new iam.WebIdentityPrincipal(
        this.oidcProvider.openIdConnectProviderArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub': 'repo:JamesWilliamsMusic/jameswilliams-web:*',
          },
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
        }
      ),
      description: 'Role assumed by jameswilliams-web for ECR push and Lambda update',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    webRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:BatchDeleteImage',
        'ecr:ListImages',
      ],
      resources: ['*'],
    }));

    webRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:GetFunction',
      ],
      resources: ['*'],
    }));

    new cdk.CfnOutput(this, 'WebRoleArn', {
      value: webRole.roleArn,
      description: 'Add this as AWS_ROLE_ARN in jameswilliams-web GitHub repo secrets',
      exportName: 'GitHubActionsWebRoleArn',
    });
  }
}
