#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { GitHubOidcStack } from '../lib/github-oidc-stack';
import { EcrStack } from '../lib/ecr-stack';
import { WebinyDeployRoleStack } from '../lib/webiny-deploy-role-stack';
import { SsmParamsStack } from '../lib/ssm-params-stack';
import { FanAccountsStack } from '../lib/fan-accounts-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { SesDomainStack } from '../lib/ses-domain-stack';
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
  recaptchaSiteKey: '6Le5820tAAAAAGBgrbXuU2x2W60nFdhtE0P-6tfs',
  recaptchaSecretKey: 'PLACEHOLDER_RECAPTCHA_SECRET', // Update via AWS console or CLI
});

new SsmParamsStack(app, 'SsmParams-Prod', {
  env: { account: ACCOUNT, region: REGION },
  envName: 'prod',
  webinyApiUrl: 'https://d21n25rxwca9lo.cloudfront.net/cms/read/en-US',
  webinyApiToken: 'PLACEHOLDER_TOKEN', // Update with real token after deploy
});

// ──────────────────────────────────────────────────────────────
// 5. SES Domain Identity (shared across environments)
// ──────────────────────────────────────────────────────────────
new SesDomainStack(app, 'SesDomain', {
  env: { account: ACCOUNT, region: REGION },
  domainName: 'jameswilliamsmusic.store',
  hostedZoneId: 'Z012204411K3MGAHA7WEM',
});

// ──────────────────────────────────────────────────────────────
// 6. Application Infrastructure (per-environment)
// ──────────────────────────────────────────────────────────────
const envName = app.node.tryGetContext('env') as string | undefined;

if (envName === 'dev' || envName === 'prod') {
  const config = loadEnvironmentConfig(app, envName);

  // Certificate stack in us-east-1 (required by CloudFront) — only for prod with domain
  let certificate;
  if (config.domainName) {
    const subjectAlternativeNames = envName === 'prod'
      ? [`www.${config.domainName}`]
      : undefined;

    const certStack = new CertificateStack(app, `${config.envName}-certificate`, {
      env: { account: config.account, region: 'us-east-1' },
      domainName: config.domainName,
      subjectAlternativeNames,
      crossRegionReferences: true,
    });
    certificate = certStack.certificate;
  }

  const infraStack = new InfraStack(app, `${config.envName}-music-portfolio`, {
    env: { account: config.account, region: config.region },
    crossRegionReferences: true,
    config,
    certificate,
  });

  // Ensure cert is created before the distribution references it
  if (config.domainName) {
    infraStack.addDependency(
      cdk.Stack.of(certificate!) as cdk.Stack
    );
  }

  new FanAccountsStack(app, `${envName}-fan-accounts`, {
    env: { account: ACCOUNT, region: REGION },
    envName,
    lambdaFunctionName: `${envName}-music-portfolio-fn`,
    cloudFrontDomain: 'd1nfcqgwk0mjlu.cloudfront.net',
  });
}

app.synth();
