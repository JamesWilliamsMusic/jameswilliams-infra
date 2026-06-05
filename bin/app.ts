#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { loadEnvironmentConfig } from '../lib/config';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') as string | undefined;
const targetEnv = (envName === 'prod' ? 'prod' : 'dev') as 'dev' | 'prod';
const config = loadEnvironmentConfig(app, targetEnv);

new InfraStack(app, `${config.envName}-music-portfolio`, {
  env: { account: config.account, region: config.region },
  config,
});

app.synth();
