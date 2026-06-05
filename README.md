# Music Portfolio Infrastructure

AWS CDK infrastructure for a music portfolio site. This is the **infra** repo in a microservice architecture alongside frontend, api, and webiny repos.

Provisions cloud resources for a containerized application with environment separation (dev/prod) and multi-account deployment support.

## Architecture

```
CloudFront Distribution (CDN + HTTPS)
        │
        ▼
API Gateway (HTTP API)
        │
        ▼
Lambda Function (Docker image from ECR)
```

Supporting services:

- **Route 53** — DNS hosted zone and alias records pointing to CloudFront
- **ACM** — SSL/TLS certificate (us-east-1) with DNS validation via Route 53
- **Cognito** — User pool for authentication with password policy enforcement

### AWS Services

| Service | Purpose |
|---------|---------|
| CloudFront | CDN with HTTPS termination and custom domain |
| API Gateway | HTTP API routing all requests to Lambda |
| Lambda | Runs the application as a Docker container |
| ECR | Stores Docker container images (retains 10 most recent) |
| Route 53 | DNS hosted zone and alias records |
| ACM | TLS certificate with DNS validation |
| Cognito | User authentication (min 8 char password policy) |

### Resource Naming

Resources use an environment prefix to avoid collisions:

- ECR: `{env}-music-portfolio`
- Lambda: `{env}-music-portfolio-fn`
- API Gateway: `{env}-music-portfolio-api`
- Cognito: `{env}-music-portfolio-users`

## Prerequisites

- Node.js 18+
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS credentials configured for the target account

## Configuring Target AWS Accounts

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

To deploy to a different AWS account (e.g., James Williams' account), update the `account` field with the target account ID. No code changes are needed — the stack is fully parameterized.

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

### CI/CD (GitHub Actions)

| Workflow | Trigger | Environment |
|----------|---------|-------------|
| `deploy-dev.yml` | Push to `main` | dev |
| `deploy-prod.yml` | Manual dispatch | prod |

Both workflows run: install → test → `cdk synth` → `cdk diff` → `cdk deploy`.

**Required GitHub Secrets:**

- Dev: `AWS_ROLE_ARN`, `AWS_REGION`
- Prod: `PROD_AWS_ROLE_ARN`, `PROD_AWS_REGION`

Authentication uses OIDC (GitHub's `id-token: write` permission).

### Manual Deployment

```bash
# Install dependencies
npm ci

# Deploy to dev
npx cdk deploy --context env=dev

# Deploy to prod
npx cdk deploy --context env=prod
```

### Synthesize Stacks Locally

```bash
# Synthesize dev stack (generates CloudFormation template)
npx cdk synth --context env=dev

# Synthesize prod stack
npx cdk synth --context env=prod

# View diff before deploying
npx cdk diff --context env=dev
```

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
lib/config.ts           Environment configuration interface and loader
lib/infra-stack.ts      Infrastructure stack (all AWS resources)
.github/workflows/      CI/CD workflows (dev + prod)
test/unit/              Unit tests (CDK assertions)
test/property/          Property-based tests (fast-check)
cdk.json                CDK app config and environment context
```

## Microservice Architecture

This repo is one part of a multi-repo architecture:

| Repo | Purpose |
|------|---------|
| **infra** (this repo) | AWS CDK infrastructure provisioning |
| **frontend** | Client-side application |
| **api** | Backend API service |
| **webiny** | CMS (Webiny) |
