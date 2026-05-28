# Music Portfolio Infrastructure

AWS CDK infrastructure for a music portfolio site. Provisions cloud resources for a containerized application with environment separation (dev/prod) and multi-account deployment support.

## Architecture

```
CloudFront Distribution (CDN + HTTPS)
        │
        ▼
Lambda Function (Docker image)
        │
        ▼
ECR Repository (container images)

Route 53 ─── ACM Certificate (TLS)
Cognito User Pool (authentication)
```

### AWS Services

| Service | Purpose |
|---------|---------|
| ECR | Stores Docker container images with lifecycle policy (retains 10 most recent) |
| Lambda | Runs the application as a Docker container |
| CloudFront | CDN with HTTPS termination and custom domain |
| Route 53 | DNS hosted zone and alias records pointing to CloudFront |
| ACM | SSL/TLS certificate with DNS validation (us-east-1) |
| Cognito | User authentication with password policy enforcement |
| CodePipeline | CI/CD pipeline with auto-deploy to dev and manual approval for prod |

### Resource Naming

Resources use an environment prefix to avoid collisions:

- ECR: `{env}-music-portfolio`
- Lambda: `{env}-music-portfolio-fn`
- Cognito: `{env}-music-portfolio-users`

## Prerequisites

- Node.js 18+
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS credentials configured for the target account
- Docker (for Lambda container image builds)

## Configuration

Environment configuration lives in `cdk.json` under the `context` key. Update the account and region values for your target AWS accounts:

```json
{
  "context": {
    "dev": {
      "account": "YOUR_DEV_ACCOUNT_ID",
      "region": "us-east-1",
      "domainName": "yourdomain.com",
      "subDomain": "dev",
      "lambdaMemorySize": 512,
      "lambdaTimeout": 30
    },
    "prod": {
      "account": "YOUR_PROD_ACCOUNT_ID",
      "region": "us-east-1",
      "domainName": "yourdomain.com",
      "lambdaMemorySize": 1024,
      "lambdaTimeout": 60
    }
  }
}
```

### Configuration Fields

| Field | Description |
|-------|-------------|
| `account` | AWS account ID for deployment |
| `region` | AWS region (us-east-1 recommended for CloudFront certificate compatibility) |
| `domainName` | Base domain for the portfolio site |
| `subDomain` | Subdomain prefix for dev environment (omit for prod to use apex domain) |
| `lambdaMemorySize` | Lambda memory in MB (128–10240) |
| `lambdaTimeout` | Lambda timeout in seconds (1–900) |

## Deployment

### Install Dependencies

```bash
npm install
```

### Synthesize Stacks

```bash
# Synthesize dev stack
npx cdk synth -c deploy=dev

# Synthesize prod stack
npx cdk synth -c deploy=prod

# Synthesize pipeline stack
npx cdk synth -c deploy=pipeline -c connectionArn=YOUR_CODESTAR_CONNECTION_ARN
```

### Deploy Individual Environments

```bash
# Deploy dev
npx cdk deploy -c deploy=dev

# Deploy prod
npx cdk deploy -c deploy=prod
```

### Deploy via CI/CD Pipeline

```bash
npx cdk deploy -c deploy=pipeline \
  -c connectionArn=arn:aws:codestar-connections:REGION:ACCOUNT:connection/ID \
  -c repoOwner=your-github-org \
  -c repoName=music-portfolio-infra \
  -c branch=main
```

Once deployed, the pipeline automatically:
1. Deploys to dev on every push to main
2. Requires manual approval before deploying to prod

## Testing

```bash
# Run all tests (unit + property)
npm test

# Run only unit tests
npx jest test/unit

# Run only property-based tests
npx jest test/property
```

### Test Structure

- `test/unit/` — CDK assertion tests verifying resource configuration
- `test/property/` — Property-based tests (fast-check) validating correctness properties across random configurations

## Project Structure

```
bin/app.ts              CDK app entry point
lib/config.ts           Environment and pipeline configuration interfaces
lib/infra-stack.ts      Infrastructure stack (ECR, Lambda, CloudFront, Route 53, ACM, Cognito)
lib/pipeline-stack.ts   CI/CD pipeline stack (CodePipeline with dev/prod stages)
cdk.json                CDK app config and environment context
```
