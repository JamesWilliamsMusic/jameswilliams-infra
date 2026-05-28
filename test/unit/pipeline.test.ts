import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../../lib/pipeline-stack';
import { PipelineConfig } from '../../lib/config';

const pipelineConfig: PipelineConfig = {
  repoOwner: 'test-owner',
  repoName: 'test-repo',
  branch: 'main',
  connectionArn: 'arn:aws:codestar-connections:us-east-1:123456789012:connection/test-id',
  devConfig: {
    envName: 'dev',
    account: '123456789012',
    region: 'us-east-1',
    domainName: 'example.com',
    subDomain: 'dev',
    lambdaMemorySize: 512,
    lambdaTimeout: 30,
  },
  prodConfig: {
    envName: 'prod',
    account: '987654321098',
    region: 'us-east-1',
    domainName: 'example.com',
    lambdaMemorySize: 1024,
    lambdaTimeout: 60,
  },
};

describe('Pipeline Stack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new PipelineStack(app, 'TestPipelineStack', {
      env: { account: '123456789012', region: 'us-east-1' },
      pipelineConfig,
    });
    // CDK Pipelines requires buildPipeline() to be called before synthesis
    stack.pipeline.buildPipeline();
    template = Template.fromStack(stack);
  });

  test('pipeline has synth step with cdk synth command', () => {
    template.hasResourceProperties('AWS::CodeBuild::Project', {
      Source: {
        BuildSpec: Match.serializedJson(
          Match.objectLike({
            phases: Match.objectLike({
              build: Match.objectLike({
                commands: Match.arrayWith([
                  'npx cdk synth',
                ]),
              }),
            }),
          })
        ),
      },
    });
  });

  test('prod stage has manual approval step', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: 'Prod',
          Actions: Match.arrayWith([
            Match.objectLike({
              ActionTypeId: Match.objectLike({
                Category: 'Approval',
                Provider: 'Manual',
              }),
              Name: 'PromoteToProd',
            }),
          ]),
        }),
      ]),
    });
  });

  test('dev stage exists without manual approval', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: 'Dev',
          Actions: Match.not(
            Match.arrayWith([
              Match.objectLike({
                ActionTypeId: Match.objectLike({
                  Category: 'Approval',
                  Provider: 'Manual',
                }),
              }),
            ])
          ),
        }),
      ]),
    });
  });
});
