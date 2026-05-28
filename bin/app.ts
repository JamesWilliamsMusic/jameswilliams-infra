#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { loadEnvironmentConfig } from '../lib/config';
import { InfraStack } from '../lib/infra-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

const deployMode = app.node.tryGetContext('deploy') as string | undefined;

if (deployMode === 'pipeline') {
  // Pipeline mode: create the CI/CD pipeline stack that manages both environments
  const devConfig = loadEnvironmentConfig(app, 'dev');
  const prodConfig = loadEnvironmentConfig(app, 'prod');

  const connectionArn = app.node.tryGetContext('connectionArn') as string;
  const repoOwner = app.node.tryGetContext('repoOwner') as string || 'owner';
  const repoName = app.node.tryGetContext('repoName') as string || 'music-portfolio-infra';
  const branch = app.node.tryGetContext('branch') as string || 'main';

  new PipelineStack(app, 'MusicPortfolioPipeline', {
    env: { account: devConfig.account, region: devConfig.region },
    pipelineConfig: {
      repoOwner,
      repoName,
      branch,
      connectionArn,
      devConfig,
      prodConfig,
    },
  });
} else {
  // Individual stack mode: deploy a single environment stack
  const targetEnv = (deployMode === 'prod' ? 'prod' : 'dev') as 'dev' | 'prod';
  const config = loadEnvironmentConfig(app, targetEnv);

  new InfraStack(app, `${config.envName}-music-portfolio`, {
    env: { account: config.account, region: config.region },
    config,
  });
}

app.synth();
