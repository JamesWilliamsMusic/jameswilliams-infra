import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface SsmParamsStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
  webinyApiUrl: string;
  webinyApiToken: string;
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;
}

/**
 * Stores shared configuration:
 *   - SSM Parameter Store for non-sensitive config (API URL, reCAPTCHA site key)
 *   - Secrets Manager for sensitive values (API token, reCAPTCHA secret key)
 *
 * Paths:
 *   SSM:     /jameswilliams/{env}/webiny/api-url
 *   SSM:     /jameswilliams/{env}/recaptcha/site-key
 *   Secret:  jameswilliams/{env}/webiny/api-token
 *   Secret:  jameswilliams/{env}/recaptcha/secret-key
 */
export class SsmParamsStack extends cdk.Stack {
  public readonly webinyApiUrlParam: ssm.StringParameter;
  public readonly webinyApiTokenSecret: secretsmanager.Secret;
  public readonly recaptchaSiteKeyParam?: ssm.StringParameter;
  public readonly recaptchaSecretKeySecret?: secretsmanager.Secret;

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

    // --- reCAPTCHA v3 (for contact form) ---

    if (props.recaptchaSiteKey) {
      // reCAPTCHA site key (public — baked into client JS at build time)
      this.recaptchaSiteKeyParam = new ssm.StringParameter(this, 'RecaptchaSiteKey', {
        parameterName: `${prefix}/recaptcha/site-key`,
        stringValue: props.recaptchaSiteKey,
        description: `Google reCAPTCHA v3 site key for ${envName} (public)`,
        tier: ssm.ParameterTier.STANDARD,
      });
    }

    if (props.recaptchaSecretKey) {
      // reCAPTCHA secret key (server-side only — never exposed to client)
      this.recaptchaSecretKeySecret = new secretsmanager.Secret(this, 'RecaptchaSecretKey', {
        secretName: `jameswilliams/${envName}/recaptcha/secret-key`,
        description: `Google reCAPTCHA v3 secret key for ${envName}`,
        secretStringValue: cdk.SecretValue.unsafePlainText(props.recaptchaSecretKey),
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'WebinyApiUrlParamName', {
      value: this.webinyApiUrlParam.parameterName,
      description: 'SSM parameter name for Webiny API URL',
    });

    new cdk.CfnOutput(this, 'WebinyApiTokenSecretArn', {
      value: this.webinyApiTokenSecret.secretArn,
      description: 'Secrets Manager ARN for Webiny API token',
    });

    if (this.recaptchaSiteKeyParam) {
      new cdk.CfnOutput(this, 'RecaptchaSiteKeyParamName', {
        value: this.recaptchaSiteKeyParam.parameterName,
        description: 'SSM parameter name for reCAPTCHA site key',
      });
    }

    if (this.recaptchaSecretKeySecret) {
      new cdk.CfnOutput(this, 'RecaptchaSecretKeyArn', {
        value: this.recaptchaSecretKeySecret.secretArn,
        description: 'Secrets Manager ARN for reCAPTCHA secret key',
      });
    }
  }
}
