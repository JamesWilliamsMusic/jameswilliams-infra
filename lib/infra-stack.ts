import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';

export interface InfraStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class InfraStack extends cdk.Stack {
  public readonly repository: ecr.Repository;
  public readonly lambdaFunction: lambda.DockerImageFunction;
  public readonly httpApi: apigw.HttpApi;
  public readonly distribution: cloudfront.Distribution;
  public readonly hostedZone: route53.HostedZone;
  public readonly certificate: acm.ICertificate;
  public readonly userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, {
      ...props,
      crossRegionReferences: true,
    });

    const { config } = props;
    const prefix = `${config.envName}-music-portfolio`;

    // --- ECR Repository ---
    this.repository = new ecr.Repository(this, 'EcrRepository', {
      repositoryName: prefix,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Retain only the 10 most recent images',
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // --- Lambda Function ---
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    this.repository.grantPull(lambdaRole);

    this.lambdaFunction = new lambda.DockerImageFunction(this, 'LambdaFunction', {
      functionName: `${prefix}-fn`,
      code: lambda.DockerImageCode.fromEcr(this.repository),
      memorySize: config.lambdaMemorySize,
      timeout: cdk.Duration.seconds(config.lambdaTimeout),
      role: lambdaRole,
    });

    // --- API Gateway HTTP API ---
    const lambdaIntegration = new apigwIntegrations.HttpLambdaIntegration(
      'LambdaIntegration',
      this.lambdaFunction
    );

    this.httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: `${prefix}-api`,
      defaultIntegration: lambdaIntegration,
      createDefaultStage: false,
    });

    this.httpApi.addStage('EnvironmentStage', {
      stageName: config.envName,
      autoDeploy: true,
    });

    // --- Route 53 Hosted Zone ---
    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: config.domainName,
    });

    // --- ACM Certificate (must be in us-east-1 for CloudFront) ---
    const certificateDomainName = config.subDomain
      ? `${config.subDomain}.${config.domainName}`
      : config.domainName;

    const certificateSubjectAlternativeNames = config.subDomain
      ? undefined
      : [`www.${config.domainName}`];

    if (this.region === 'us-east-1' || cdk.Token.isUnresolved(this.region)) {
      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName: certificateDomainName,
        subjectAlternativeNames: certificateSubjectAlternativeNames,
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
      });
    } else {
      this.certificate = new acm.DnsValidatedCertificate(this, 'Certificate', {
        domainName: certificateDomainName,
        subjectAlternativeNames: certificateSubjectAlternativeNames,
        hostedZone: this.hostedZone,
        region: 'us-east-1',
      });
    }

    // --- CloudFront Distribution ---
    const domainNames = config.subDomain
      ? [`${config.subDomain}.${config.domainName}`]
      : [config.domainName, `www.${config.domainName}`];

    // Use API Gateway HTTP API as the origin for CloudFront
    const apiEndpointDomain = `${this.httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`;

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(apiEndpointDomain, {
          originPath: `/${config.envName}`,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      domainNames,
      certificate: this.certificate,
    });

    // --- Route 53 DNS Records ---
    const recordName = config.subDomain
      ? `${config.subDomain}.${config.domainName}`
      : config.domainName;

    new route53.ARecord(this, 'AliasRecord', {
      zone: this.hostedZone,
      recordName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(this.distribution)
      ),
    });

    // --- Cognito User Pool ---
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-users`,
      passwordPolicy: {
        minLength: 8,
      },
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `${prefix}-app-client`,
      authFlows: {
        userSrp: true,
      },
    });
  }
}
