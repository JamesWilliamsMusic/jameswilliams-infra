#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GitHubOidcStack } from '../lib/github-oidc-stack';

/**
 * Bootstrap script to create the GitHub OIDC provider and deploy role.
 *
 * Run this ONCE manually before using GitHub Actions:
 *   npx cdk deploy --app "npx ts-node bin/bootstrap-oidc.ts"
 *
 * After deployment, copy the output DeployRoleArn and add it
 * as AWS_ROLE_ARN in your GitHub repo secrets.
 */
const app = new cdk.App();

new GitHubOidcStack(app, 'GitHubOidcBootstrap', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
  },

  // Your infra repo
  githubRepo: 'joonochakma/jameswilliams-infra',

  // Other repos that need to deploy to this account
  additionalRepos: [
    'JamesWilliamsMusic/jameswilliams-web',
    'JamesWilliamsMusic/jameswilliams-api',
    'JamesWilliamsMusic/jameswilliams-infra',
  ],
});

app.synth();
