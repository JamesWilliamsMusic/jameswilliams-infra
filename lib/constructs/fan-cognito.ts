import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface FanCognitoConstructProps {
  envName: string;
  cloudFrontDomain: string;
}

export class FanCognitoConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: FanCognitoConstructProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'FanUserPool', {
      userPoolName: `${props.envName}-jameswilliams-fan-pool`,
      signInAliases: {
        email: true,
      },
      selfSignUpEnabled: true,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      userVerification: {
        emailSubject: 'Verify your email',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      autoVerify: {
        email: true,
      },
      customAttributes: {
        consent_version: new cognito.StringAttribute({ mutable: true }),
        consent_date: new cognito.StringAttribute({ mutable: true }),
      },
      deletionProtection: true,
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const callbackUrls = [
      `https://${props.cloudFrontDomain}`,
      'http://localhost:3000',
    ];

    const logoutUrls = [
      `https://${props.cloudFrontDomain}`,
      'http://localhost:3000',
    ];

    this.userPoolClient = new cognito.UserPoolClient(this, 'FanUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${props.envName}-jameswilliams-web-client`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });
  }
}
