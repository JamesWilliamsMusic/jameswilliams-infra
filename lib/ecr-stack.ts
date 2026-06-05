import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface EcrStackProps extends cdk.StackProps {
  /**
   * List of service names to create ECR repositories for.
   * Each service gets a repo named: {service}
   * e.g., ["jameswilliams-web", "jameswilliams-api"]
   */
  services: string[];
}

export class EcrStack extends cdk.Stack {
  public readonly repositories: Map<string, ecr.Repository> = new Map();

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    for (const service of props.services) {
      const repo = new ecr.Repository(this, `Ecr-${service}`, {
        repositoryName: service,
        imageScanOnPush: true,
        lifecycleRules: [
          {
            maxImageCount: 10,
            description: 'Retain only the 10 most recent images',
          },
        ],
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

      this.repositories.set(service, repo);

      // Output each repo URI so it's easy to find
      new cdk.CfnOutput(this, `EcrUri-${service}`, {
        value: repo.repositoryUri,
        description: `ECR repository URI for ${service}`,
        exportName: `EcrUri-${service}`,
      });

      // Output just the repo name (matches what GitHub Actions needs as ECR_REPOSITORY)
      new cdk.CfnOutput(this, `EcrName-${service}`, {
        value: repo.repositoryName,
        description: `ECR repository name for ${service} (use as ECR_REPOSITORY in GitHub)`,
        exportName: `EcrName-${service}`,
      });
    }
  }
}
