import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface SsmParamsStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
  webinyApiUrl: string;
  webinyApiToken: string;
}

/**
 * Stores shared configuration in SSM Parameter Store.
 * Services (Lambda, CI) read these at runtime or build time.
 *
 * Parameter paths:
 *   /jameswilliams/{env}/webiny/api-url
 *   /jameswilliams/{env}/webiny/api-token  (SecureString)
 */
export class SsmParamsStack extends cdk.Stack {
  public readonly webinyApiUrlParam: ssm.StringParameter;
  public readonly webinyApiTokenParam: ssm.StringParameter;

  constructor(scope: Construct, id: string, props: SsmParamsStackProps) {
    super(scope, id, props);

    const { envName, webinyApiUrl, webinyApiToken } = props;
    const prefix = `/jameswilliams/${envName}`;

    // Webiny API URL (plain string — not secret)
    this.webinyApiUrlParam = new ssm.StringParameter(this, 'WebinyApiUrl', {
      parameterName: `${prefix}/webiny/api-url`,
      stringValue: webinyApiUrl,
      description: `Webiny CMS read API URL for ${envName}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Webiny API Token (stored as regular string in SSM — use Secrets Manager
    // if you need automatic rotation, but SSM is fine for static API tokens)
    this.webinyApiTokenParam = new ssm.StringParameter(this, 'WebinyApiToken', {
      parameterName: `${prefix}/webiny/api-token`,
      stringValue: webinyApiToken,
      description: `Webiny CMS API token for ${envName}`,
      tier: ssm.ParameterTier.STANDARD,
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebinyApiUrlParamName', {
      value: this.webinyApiUrlParam.parameterName,
      description: 'SSM parameter name for Webiny API URL',
    });

    new cdk.CfnOutput(this, 'WebinyApiTokenParamName', {
      value: this.webinyApiTokenParam.parameterName,
      description: 'SSM parameter name for Webiny API token',
    });
  }
}
