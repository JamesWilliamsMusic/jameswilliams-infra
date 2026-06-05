#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcrStack } from '../lib/ecr-stack';

/**
 * Deploy ECR repositories for all microservices.
 *
 * Add or remove services from the array below.
 * Each service gets its own ECR repo with the same name.
 *
 * Usage:
 *   npx cdk deploy --app "npx ts-node bin/deploy-ecr.ts"
 */
const app = new cdk.App();

new EcrStack(app, 'EcrRepositories', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '730335304134',
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',
  },

  // Add your microservice repos here — each gets an ECR repo with this name
  services: [
    'jameswilliams-web',
    'jameswilliams-api',
  ],
});

app.synth();
