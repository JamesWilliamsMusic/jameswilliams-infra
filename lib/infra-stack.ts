import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    // Add a function URL for CloudFront origin
    const functionUrl = this.lambdaFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // --- Route 53 Hosted Zone ---
    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: config.domainName,
    });

    // --- ACM Certificate (must be in us-east-1 for CloudFront) ---
    // When the stack region is us-east-1, the certificate is created directly.
    // When the stack region differs, crossRegionReferences is enabled on the stack
    // and a separate certificate stack is created in us-east-1 automatically by CDK
    // when using CDK Pipelines. For standalone deployment in a non-us-east-1 region,
    // a dedicated certificate stack in us-east-1 would be required.
    const certificateDomainName = config.subDomain
      ? `${config.subDomain}.${config.domainName}`
      : config.domainName;

    const certificateSubjectAlternativeNames = config.subDomain
      ? undefined
      : [`www.${config.domainName}`];

    if (this.region === 'us-east-1' || cdk.Token.isUnresolved(this.region)) {
      // Stack is in us-east-1 or region is a token (resolved at deploy time) —
      // create the certificate directly in this stack.
      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName: certificateDomainName,
        subjectAlternativeNames: certificateSubjectAlternativeNames,
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
      });
    } else {
      // Stack is in a different region — create a cross-region certificate
      // using DnsValidatedCertificate which provisions in us-east-1.
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

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(functionUrl),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
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
