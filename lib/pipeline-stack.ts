import * as cdk from 'aws-cdk-lib';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { PipelineConfig } from './config';
import { InfraStack } from './infra-stack';

export interface PipelineStackProps extends cdk.StackProps {
  pipelineConfig: PipelineConfig;
}

/**
 * CDK Pipelines stage that wraps the InfraStack for a given environment.
 */
class InfraStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: cdk.StageProps & { config: import('./config').EnvironmentConfig }) {
    super(scope, id, props);

    new InfraStack(this, 'InfraStack', {
      env: { account: props.config.account, region: props.config.region },
      config: props.config,
    });
  }
}

export class PipelineStack extends cdk.Stack {
  public readonly pipeline: pipelines.CodePipeline;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const { pipelineConfig } = props;

    // Create the CDK Pipeline with GitHub source connection
    this.pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'music-portfolio-pipeline',
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(
          `${pipelineConfig.repoOwner}/${pipelineConfig.repoName}`,
          pipelineConfig.branch,
          { connectionArn: pipelineConfig.connectionArn }
        ),
        commands: [
          'npm ci',
          'npx cdk synth',
        ],
      }),
    });

    // Dev stage: auto-deploy (no approval)
    this.pipeline.addStage(
      new InfraStage(this, 'Dev', {
        env: { account: pipelineConfig.devConfig.account, region: pipelineConfig.devConfig.region },
        config: pipelineConfig.devConfig,
      })
    );

    // Prod stage: manual approval gate before deployment
    this.pipeline.addStage(
      new InfraStage(this, 'Prod', {
        env: { account: pipelineConfig.prodConfig.account, region: pipelineConfig.prodConfig.region },
        config: pipelineConfig.prodConfig,
      }),
      {
        pre: [
          new pipelines.ManualApprovalStep('PromoteToProd', {
            comment: 'Approve deployment to production environment',
          }),
        ],
      }
    );
  }
}
