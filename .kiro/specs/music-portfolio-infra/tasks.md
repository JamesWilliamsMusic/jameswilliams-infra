# Implementation Plan: Music Portfolio Infrastructure

## Overview

Implement the AWS CDK infrastructure for a music portfolio site using TypeScript. The implementation builds incrementally: project scaffolding → environment config → core infrastructure resources → pipeline → tests → documentation.

## Tasks

- [x] 1. Set up CDK project structure and configuration
  - [x] 1.1 Initialize CDK project with TypeScript and install dependencies
    - Create `package.json` with `aws-cdk-lib`, `constructs`, `jest`, `ts-jest`, `fast-check`, and `@types/jest`
    - Create `tsconfig.json` with strict mode enabled
    - Create `cdk.json` with app entry point and environment context for dev and prod
    - Create `jest.config.ts` configured for TypeScript with test paths for `test/unit` and `test/property`
    - _Requirements: 1.1_

  - [x] 1.2 Implement environment configuration module (`lib/config.ts`)
    - Define `EnvironmentConfig` interface with `envName`, `account`, `region`, `domainName`, `subDomain`, `lambdaMemorySize`, `lambdaTimeout`
    - Define `PipelineConfig` interface with `repoOwner`, `repoName`, `branch`, `connectionArn`, `devConfig`, `prodConfig`
    - Export helper function to load config from CDK context with validation (throw descriptive error if values missing)
    - _Requirements: 1.2, 1.3, 9.1, 9.2_

  - [x] 1.3 Implement CDK app entry point (`bin/app.ts`)
    - Instantiate CDK App
    - Read environment configuration from `cdk.json` context
    - Conditionally create pipeline stack or individual environment stacks based on context
    - _Requirements: 1.1, 9.3_

- [x] 2. Implement infrastructure stack core resources
  - [x] 2.1 Create infrastructure stack scaffold (`lib/infra-stack.ts`)
    - Define `InfraStack` class extending `cdk.Stack`
    - Accept `EnvironmentConfig` as a prop
    - Set up resource naming convention using `{envName}-music-portfolio` prefix
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 2.2 Implement ECR repository resource
    - Create `ecr.Repository` with lifecycle rule retaining 10 most recent images
    - Enable image scanning on push
    - Name repository with environment prefix: `{envName}-music-portfolio`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.3 Implement Lambda function resource
    - Create `lambda.DockerImageFunction` using ECR image
    - Configure memory size and timeout from `EnvironmentConfig`
    - Create IAM execution role with least-privilege permissions (ECR pull access)
    - Name function: `{envName}-music-portfolio-fn`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.4 Implement Route 53 hosted zone and DNS records
    - Create `route53.HostedZone` for the portfolio domain
    - Create `route53.ARecord` as alias to CloudFront distribution
    - Use subdomain prefix for dev environment, apex/www for prod
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.5 Implement ACM certificate
    - Create `acm.Certificate` with DNS validation via Route 53
    - Ensure certificate is provisioned in us-east-1 for CloudFront compatibility
    - Handle cross-region pattern if primary region differs from us-east-1
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.6 Implement CloudFront distribution
    - Create `cloudfront.Distribution` with Lambda function URL as origin
    - Attach ACM certificate for HTTPS termination
    - Configure custom domain as alternate domain name from Route 53 zone
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.7 Implement Cognito user pool
    - Create `cognito.UserPool` with password policy (minimum 8 characters)
    - Create app client for the frontend application
    - Name user pool: `{envName}-music-portfolio-users`
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 3. Checkpoint - Verify stack synthesizes correctly
  - Ensure `cdk synth` runs without errors for both dev and prod configurations, ask the user if questions arise.

- [x] 4. Implement CI/CD pipeline stack
  - [x] 4.1 Create pipeline stack (`lib/pipeline-stack.ts`)
    - Define `PipelineStack` class extending `cdk.Stack`
    - Accept `PipelineConfig` as a prop
    - Create `pipelines.CodePipeline` with GitHub source connection
    - Configure synth step with `npx cdk synth`
    - _Requirements: 8.3, 8.4_

  - [x] 4.2 Add deployment stages to pipeline
    - Add dev stage with auto-deploy (no approval)
    - Add prod stage with manual approval gate before deployment
    - Wire `InfraStack` into each stage with appropriate environment config
    - _Requirements: 8.1, 8.2_

- [x] 5. Checkpoint - Verify pipeline and stacks synthesize
  - Ensure all stacks synthesize cleanly, run `cdk synth` and verify no errors, ask the user if questions arise.

- [x] 6. Write unit tests
  - [x] 6.1 Write unit tests for ECR resource (`test/unit/ecr.test.ts`)
    - Assert ECR repository exists in synthesized template
    - Assert lifecycle rule retains 10 images
    - Assert image scanning on push is enabled
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.2 Write unit tests for Lambda resource (`test/unit/lambda.test.ts`)
    - Assert Lambda function exists with Docker image configuration
    - Assert memory size and timeout match environment config
    - Assert IAM role has ECR pull permissions
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.3 Write unit tests for CloudFront resource (`test/unit/cloudfront.test.ts`)
    - Assert CloudFront distribution exists
    - Assert ACM certificate is attached
    - Assert custom domain is configured as alternate domain name
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.4 Write unit tests for DNS and ACM resources (`test/unit/dns.test.ts`)
    - Assert Route 53 hosted zone exists
    - Assert A record alias points to CloudFront
    - Assert ACM certificate uses DNS validation
    - Assert dev uses subdomain, prod uses apex/www
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 6.5 Write unit tests for Cognito resource (`test/unit/cognito.test.ts`)
    - Assert Cognito user pool exists
    - Assert password policy minimum length is 8
    - Assert app client is created
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.6 Write unit tests for pipeline structure (`test/unit/pipeline.test.ts`)
    - Assert pipeline has synth step
    - Assert dev stage exists without manual approval
    - Assert prod stage exists with manual approval
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 7. Write property-based tests
  - [ ]* 7.1 Write property test for environment-specific naming (`test/property/naming.property.ts`)
    - **Property 1: Environment-specific resource naming**
    - Generate random valid EnvironmentConfig objects with arbitrary envName
    - Synthesize stack and assert all named resources contain the environment name prefix
    - Minimum 100 iterations
    - **Validates: Requirements 1.4, 1.5**

  - [ ]* 7.2 Write property test for account externalization (`test/property/account.property.ts`)
    - **Property 2: Account and region externalization**
    - Generate random valid account IDs and regions
    - Synthesize stack and assert template references only provided values with no hardcoded identifiers
    - Minimum 100 iterations
    - **Validates: Requirements 1.3, 9.1, 9.2**

  - [ ]* 7.3 Write property test for Lambda configuration (`test/property/lambda.property.ts`)
    - **Property 3: Lambda configuration reflects environment**
    - Generate random valid memory sizes (128-10240) and timeouts (1-900)
    - Synthesize stack and assert Lambda MemorySize and Timeout match configured values exactly
    - Minimum 100 iterations
    - **Validates: Requirements 3.2**

  - [ ]* 7.4 Write property test for DNS domain (`test/property/dns.property.ts`)
    - **Property 4: DNS record uses environment-appropriate domain**
    - Generate random valid domain names and subdomain prefixes
    - Synthesize stack with dev config and assert DNS record includes subdomain
    - Synthesize stack with prod config and assert DNS record uses apex/www
    - Minimum 100 iterations
    - **Validates: Requirements 5.3, 5.4**

- [x] 8. Checkpoint - Ensure all tests pass
  - Run `npm test` and ensure all unit tests and property tests pass, ask the user if questions arise.

- [x] 9. Create README documentation
  - [x] 9.1 Write project README (`README.md`)
    - Document architecture overview with provisioned AWS services and their purpose
    - Describe deployment process for dev and prod environments
    - Include instructions for configuring target AWS accounts
    - Document how to run tests and synthesize stacks locally
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 10. Final checkpoint - Ensure all tests pass and project is complete
  - Ensure all tests pass, `cdk synth` succeeds for both environments, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests use CDK Assertions (`Template.fromStack()`, `hasResourceProperties()`)
- All code is TypeScript as specified in the design
