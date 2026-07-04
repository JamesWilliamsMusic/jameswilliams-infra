#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';
import { EcrStack } from '../lib/ecr-stack';
import { WebinyDeployRoleStack } from '../lib/webiny-deploy-role-stack';
import { SsmParamsStack } from '../lib/ssm-params-stack';
import { loadEnvironmentConfig } from '../lib/config';

const app = new cdk.App();

const ACCOUNT = '986995923840';
const REGION = 'ap-southeast-2';

// ──────────────────────────────────────────────────────────────
// 1. GitHub OIDC Bootstrap (deploy once manually)
// ──────────────────────────────────────────────────────────────
new GitHubOidcStack(app, 'GitHubOidcBootstrap', {
  env: { account: ACCOUNT, region: REGION },
  githubRepo: 'joonochakma/jameswilliams-infra',
  additionalRepos: [
    'JamesWilliamsMusic/jameswilliams-web',
    'JamesWilliamsMusic/jameswilliams-api',
    'JamesWilliamsMusic/jameswilliams-infra',
  ],
});

// ──────────────────────────────────────────────────────────────
// 2. ECR Repositories
// ──────────────────────────────────────────────────────────────
new EcrStack(app, 'EcrRepositories', {
  env: { account: ACCOUNT, region: REGION },
  services: [
    'jameswilliams-web',
    'jameswilliams-api',
  ],
});

// ──────────────────────────────────────────────────────────────
// 3. Webiny Deployment Role (GitHub Actions OIDC)
// ──────────────────────────────────────────────────────────────
new WebinyDeployRoleStack(app, 'WebinyDeployRole-Dev', {
  env: { account: ACCOUNT, region: REGION },
  webinyRepo: 'JamesWilliamsMusic/jameswilliams-webiny',
  envName: 'dev',
});

new WebinyDeployRoleStack(app, 'WebinyDeployRole-Prod', {
  env: { account: ACCOUNT, region: REGION },
  webinyRepo: 'JamesWilliamsMusic/jameswilliams-webiny',
  envName: 'prod',
});

// ──────────────────────────────────────────────────────────────
// 4. SSM Parameters (shared config for services)
// ──────────────────────────────────────────────────────────────
new SsmParamsStack(app, 'SsmParams-Dev', {
  env: { account: ACCOUNT, region: REGION },
  envName: 'dev',
  webinyApiUrl: 'https://d21n25rxwca9lo.cloudfront.net/cms/read/en-US',
  webinyApiToken: 'PLACEHOLDER_TOKEN', // Update with real token after deploy
});

new SsmParamsStack(app, 'SsmParams-Prod', {
  env: { account: ACCOUNT, region: REGION },
  envName: 'prod',
  webinyApiUrl: 'https://d21n25rxwca9lo.cloudfront.net/cms/read/en-US',
  webinyApiToken: 'PLACEHOLDER_TOKEN', // Update with real token after deploy
});

// ──────────────────────────────────────────────────────────────
// 5. Application Infrastructure (per-environment)
// ──────────────────────────────────────────────────────────────
const envName = app.node.tryGetContext('env') as string | undefined;

if (envName === 'dev' || envName === 'prod') {
  const config = loadEnvironmentConfig(app, envName);
  new InfraStack(app, `${config.envName}-music-portfolio`, {
    env: { account: config.account, region: config.region },
    config,
  });
}

app.synth();
