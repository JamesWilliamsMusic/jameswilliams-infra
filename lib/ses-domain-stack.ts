import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SesDomainStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId: string;
}

/**
 * Verifies a domain with SES and sets up DKIM + MAIL FROM.
 * Uses Route 53 for automatic DNS record management.
 */
export class SesDomainStack extends cdk.Stack {
  public readonly domainIdentity: ses.EmailIdentity;

  constructor(scope: Construct, id: string, props: SesDomainStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    // SES Domain Identity with DKIM signing
    this.domainIdentity = new ses.EmailIdentity(this, 'DomainIdentity', {
      identity: ses.Identity.publicHostedZone(hostedZone),
      mailFromDomain: `mail.${props.domainName}`,
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, 'SesDomainIdentity', {
      value: props.domainName,
      description: 'SES verified domain identity',
    });

    new cdk.CfnOutput(this, 'MailFromDomain', {
      value: `mail.${props.domainName}`,
      description: 'MAIL FROM subdomain for SES',
    });
  }
}
