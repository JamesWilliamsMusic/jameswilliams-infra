import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface CertificateStackProps extends cdk.StackProps {
  domainName: string;
  /** Additional subject alternative names (e.g. www subdomain). Defaults to none. */
  subjectAlternativeNames?: string[];
}

/**
 * Creates an ACM certificate in us-east-1 for use with CloudFront.
 * CloudFront requires certificates to be in us-east-1 regardless of where
 * other resources are deployed.
 *
 * DNS validation records must be added manually on GoDaddy after deployment.
 */
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    this.certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: props.domainName,
      ...(props.subjectAlternativeNames && props.subjectAlternativeNames.length > 0 && {
        subjectAlternativeNames: props.subjectAlternativeNames,
      }),
      validation: acm.CertificateValidation.fromDns(),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM certificate ARN — add DNS validation CNAME records on Manage.get.store',
    });
  }
}
