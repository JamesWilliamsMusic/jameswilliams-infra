import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface SsmParamsStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
  webinyApiUrl: string;
  webinyApiToken: string;
}

/**
 * Stores shared configuration:
 *   - SSM Parameter Store for non-sensitive config (API URL)
 *   - Secrets Manager for sensitive values (API token)
 *
 * Paths:
 *   SSM:     /jameswilliams/{env}/webiny/api-url
 *   Secret:  jameswilliams/{env}/webiny/api-token
 */
export class SsmParamsStack extends cdk.Stack {
  public readonly webinyApiUrlParam: ssm.StringParameter;
  public readonly webinyApiTokenSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: SsmParamsStackProps) {
    super(scope, id, props);

    const { envName, webinyApiUrl, webinyApiToken } = props;
    const prefix = `/jameswilliams/${envName}`;

    // Webiny API URL (plain string in SSM — not sensitive)
    this.webinyApiUrlParam = new ssm.StringParameter(this, 'WebinyApiUrl', {
      parameterName: `${prefix}/webiny/api-url`,
      stringValue: webinyApiUrl,
      description: `Webiny CMS read API URL for ${envName}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Webiny API Token (in Secrets Manager — encrypted, auditable)
    this.webinyApiTokenSecret = new secretsmanager.Secret(this, 'WebinyApiToken', {
      secretName: `jameswilliams/${envName}/webiny/api-token`,
      description: `Webiny CMS API token for ${envName}`,
      secretStringValue: cdk.SecretValue.unsafePlainText(webinyApiToken),
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebinyApiUrlParamName', {
      value: this.webinyApiUrlParam.parameterName,
      description: 'SSM parameter name for Webiny API URL',
    });

    new cdk.CfnOutput(this, 'WebinyApiTokenSecretArn', {
      value: this.webinyApiTokenSecret.secretArn,
      description: 'Secrets Manager ARN for Webiny API token',
    });
  }
}
