import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FanCognitoConstruct } from '../../lib/constructs/fan-cognito';

describe('FanCognitoConstruct', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    new FanCognitoConstruct(stack, 'TestCognito', {
      envName: 'dev',
      cloudFrontDomain: 'test.cloudfront.net',
    });
    template = Template.fromStack(stack);
  });

  test('User Pool name matches {env}-jameswilliams-fan-pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'dev-jameswilliams-fan-pool',
    });
  });

  test('sign-in alias is email', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
    });
  });

  test('password policy requires min 8 chars, uppercase, lowercase, digits, symbols', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireUppercase: true,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
        },
      },
    });
  });

  test('MFA is optional with TOTP enabled', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
    });
  });

  test('email verification is code-based', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      VerificationMessageTemplate: {
        DefaultEmailOption: 'CONFIRM_WITH_CODE',
      },
      AutoVerifiedAttributes: ['email'],
    });
  });

  test('custom attributes consent_version and consent_date exist', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      Schema: [
        {
          AttributeDataType: 'String',
          Mutable: true,
          Name: 'consent_version',
        },
        {
          AttributeDataType: 'String',
          Mutable: true,
          Name: 'consent_date',
        },
      ],
    });
  });

  test('deletion protection is enabled', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      DeletionProtection: 'ACTIVE',
    });
  });

  test('advanced security mode is enforced', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolAddOns: {
        AdvancedSecurityMode: 'ENFORCED',
      },
    });
  });

  test('account recovery is email only', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AccountRecoverySetting: {
        RecoveryMechanisms: [
          {
            Name: 'verified_email',
            Priority: 1,
          },
        ],
      },
    });
  });

  test('App Client name matches {env}-jameswilliams-web-client', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'dev-jameswilliams-web-client',
    });
  });

  test('App Client has no secret generated', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
    });
  });

  test('App Client auth flows include SRP', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: [
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
    });
  });

  test('App Client OAuth scopes include openid, email, profile', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
    });
  });

  test('App Client OAuth flows use authorization code grant', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
    });
  });

  test('App Client token validity is 60 min access, 60 min ID, 43200 min refresh', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      RefreshTokenValidity: 43200,
      TokenValidityUnits: {
        AccessToken: 'minutes',
        IdToken: 'minutes',
        RefreshToken: 'minutes',
      },
    });
  });

  test('callback URLs include CloudFront domain and localhost', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: [
        'https://test.cloudfront.net',
        'http://localhost:3000',
      ],
    });
  });

  test('logout URLs include CloudFront domain and localhost', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      LogoutURLs: [
        'https://test.cloudfront.net',
        'http://localhost:3000',
      ],
    });
  });
});
