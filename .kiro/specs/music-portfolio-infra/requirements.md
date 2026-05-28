# Requirements Document

## Introduction

This document defines the requirements for the AWS CDK infrastructure project supporting a music portfolio site. The infrastructure repo provisions cloud resources for a containerized application using a microservice architecture. It must be deployable across multiple AWS accounts (developer's own account and James Williams' account) and support two environments: dev and prod. The infrastructure is one repo in a multi-repo architecture (frontend, infra, api, webiny).

## Glossary

- **CDK_Stack**: An AWS CDK construct representing a deployable unit of cloud infrastructure
- **Pipeline**: A CI/CD pipeline that automates infrastructure deployment
- **Dev_Environment**: The development environment used for testing and iteration
- **Prod_Environment**: The production environment serving live traffic
- **Lambda_Function**: An AWS Lambda function configured to run a container image from ECR
- **ECR_Repository**: An Amazon Elastic Container Registry repository storing Docker images
- **CloudFront_Distribution**: An Amazon CloudFront CDN distribution for content delivery
- **Route53_Zone**: An Amazon Route 53 hosted zone managing DNS records
- **ACM_Certificate**: An AWS Certificate Manager SSL/TLS certificate
- **Cognito_UserPool**: An Amazon Cognito user pool for authentication

## Requirements

### Requirement 1: CDK Project Structure

**User Story:** As a developer, I want a well-structured CDK project with environment separation, so that I can deploy infrastructure independently to dev and prod.

#### Acceptance Criteria

1. THE CDK_Stack SHALL define infrastructure resources using AWS CDK in TypeScript
2. THE CDK_Stack SHALL accept environment configuration parameters to distinguish between Dev_Environment and Prod_Environment
3. THE CDK_Stack SHALL support deployment to different AWS accounts by accepting account and region configuration as parameters
4. WHEN deploying to Dev_Environment, THE CDK_Stack SHALL use dev-specific resource naming and configuration
5. WHEN deploying to Prod_Environment, THE CDK_Stack SHALL use prod-specific resource naming and configuration

### Requirement 2: ECR Repository Provisioning

**User Story:** As a developer, I want an ECR repository provisioned, so that Docker images for the Lambda function can be stored and versioned.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create an ECR_Repository for storing Docker container images
2. THE ECR_Repository SHALL have an image lifecycle policy that retains the 10 most recent images
3. THE ECR_Repository SHALL enable image scanning on push

### Requirement 3: Lambda Function Provisioning

**User Story:** As a developer, I want a Lambda function backed by a Docker image from ECR, so that the application can run as a containerized service.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create a Lambda_Function configured to use a container image from the ECR_Repository
2. THE Lambda_Function SHALL have a configurable memory size and timeout per environment
3. THE Lambda_Function SHALL have an associated IAM execution role with least-privilege permissions
4. WHEN the Lambda_Function is invoked, THE Lambda_Function SHALL pull the container image from the ECR_Repository

### Requirement 4: CloudFront Distribution

**User Story:** As a developer, I want a CloudFront distribution in front of the Lambda function, so that content is delivered with low latency globally.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create a CloudFront_Distribution with the Lambda_Function as an origin
2. THE CloudFront_Distribution SHALL use the ACM_Certificate for HTTPS termination
3. THE CloudFront_Distribution SHALL use the custom domain from the Route53_Zone as an alternate domain name

### Requirement 5: Route 53 DNS Configuration

**User Story:** As a developer, I want DNS managed through Route 53, so that the portfolio site is accessible via a custom domain.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create a Route53_Zone for the portfolio domain
2. THE CDK_Stack SHALL create DNS records pointing the custom domain to the CloudFront_Distribution
3. WHEN deploying to Dev_Environment, THE CDK_Stack SHALL use a dev subdomain prefix for the DNS record
4. WHEN deploying to Prod_Environment, THE CDK_Stack SHALL use the apex domain or www subdomain for the DNS record

### Requirement 6: ACM Certificate

**User Story:** As a developer, I want an SSL/TLS certificate provisioned via ACM, so that the site is served securely over HTTPS.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create an ACM_Certificate for the portfolio domain
2. THE ACM_Certificate SHALL be provisioned in us-east-1 region for CloudFront compatibility
3. THE ACM_Certificate SHALL use DNS validation via the Route53_Zone

### Requirement 7: Cognito User Pool

**User Story:** As a developer, I want a Cognito user pool provisioned, so that the portfolio site can support authenticated access.

#### Acceptance Criteria

1. THE CDK_Stack SHALL create a Cognito_UserPool for user authentication
2. THE Cognito_UserPool SHALL have a configured app client for the frontend application
3. THE Cognito_UserPool SHALL enforce a password policy with a minimum length of 8 characters

### Requirement 8: CI/CD Pipeline

**User Story:** As a developer, I want a CI/CD pipeline, so that infrastructure changes are deployed automatically to dev and manually to prod.

#### Acceptance Criteria

1. THE Pipeline SHALL automatically deploy the CDK_Stack to Dev_Environment when changes are pushed to the main branch
2. THE Pipeline SHALL require manual approval before deploying the CDK_Stack to Prod_Environment
3. THE Pipeline SHALL run CDK synthesis and diff steps before deployment
4. IF CDK synthesis fails, THEN THE Pipeline SHALL halt deployment and report the error

### Requirement 9: Multi-Account Deployment Support

**User Story:** As a developer, I want the infrastructure to be deployable across different AWS accounts, so that I can first deploy to my own account and later to James Williams' account.

#### Acceptance Criteria

1. THE CDK_Stack SHALL externalize AWS account ID and region as configuration parameters
2. THE CDK_Stack SHALL not hardcode any account-specific values in the stack definitions
3. WHEN a new target account is configured, THE CDK_Stack SHALL deploy without code changes to the stack definitions

### Requirement 10: README Documentation

**User Story:** As a developer, I want an updated README summarizing the infrastructure, so that collaborators understand the project structure and deployment process.

#### Acceptance Criteria

1. THE CDK_Stack project SHALL include a README file documenting the architecture overview
2. THE README SHALL describe the deployment process for both Dev_Environment and Prod_Environment
3. THE README SHALL list all provisioned AWS services and their purpose
