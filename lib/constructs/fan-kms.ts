import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface FanKmsConstructProps {
  envName: string;
}

export class FanKmsConstruct extends Construct {
  public readonly key: kms.Key;

  constructor(scope: Construct, id: string, props: FanKmsConstructProps) {
    super(scope, id);

    this.key = new kms.Key(this, 'FanDataKey', {
      alias: `alias/${props.envName}-jameswilliams-fan-data`,
      enableKeyRotation: true,
      rotationPeriod: cdk.Duration.days(365),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
