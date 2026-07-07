# Secrets & Configuration

## Overview

This project uses two AWS services for managing configuration:

| Type | Service | Use for |
|------|---------|---------|
| Non-sensitive config | SSM Parameter Store | URLs, feature flags, region names |
| Sensitive credentials | Secrets Manager | API tokens, passwords, keys |

## Current Parameters

### Dev Environment

| Name | Service | Path |
|------|---------|------|
| Webiny API URL | SSM | `/jameswilliams/dev/webiny/api-url` |
| Webiny API Token | Secrets Manager | `jameswilliams/dev/webiny/api-token` |

### Prod Environment

| Name | Service | Path |
|------|---------|------|
| Webiny API URL | SSM | `/jameswilliams/prod/webiny/api-url` |
| Webiny API Token | Secrets Manager | `jameswilliams/prod/webiny/api-token` |

## Reading Values

### From CLI

```bash
# SSM (plain config)
aws ssm get-parameter \
  --name "/jameswilliams/dev/webiny/api-url" \
  --query Parameter.Value --output text \
  --profile jameswilliams --region ap-southeast-2

# Secrets Manager (sensitive)
aws secretsmanager get-secret-value \
  --secret-id "jameswilliams/dev/webiny/api-token" \
  --query SecretString --output text \
  --profile jameswilliams --region ap-southeast-2
```

### From GitHub Actions

```yaml
- name: Fetch config from AWS
  run: |
    echo "WEBINY_API_URL=$(aws ssm get-parameter \
      --name /jameswilliams/dev/webiny/api-url \
      --query Parameter.Value --output text)" >> $GITHUB_ENV

    echo "WEBINY_API_TOKEN=$(aws secretsmanager get-secret-value \
      --secret-id jameswilliams/dev/webiny/api-token \
      --query SecretString --output text)" >> $GITHUB_ENV
```

### From Lambda (Node.js runtime)

```typescript
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const ssm = new SSMClient({});
const sm = new SecretsManagerClient({});

const url = await ssm.send(new GetParameterCommand({
  Name: '/jameswilliams/dev/webiny/api-url',
}));

const secret = await sm.send(new GetSecretValueCommand({
  SecretId: 'jameswilliams/dev/webiny/api-token',
}));
```

## Updating Values

### SSM Parameter (non-sensitive)

```bash
aws ssm put-parameter \
  --name "/jameswilliams/dev/webiny/api-url" \
  --value "https://new-url.cloudfront.net/cms/read/en-US" \
  --type String \
  --overwrite \
  --profile jameswilliams --region ap-southeast-2
```

### Secrets Manager (sensitive)

```bash
aws secretsmanager put-secret-value \
  --secret-id "jameswilliams/dev/webiny/api-token" \
  --secret-string "your-new-token-here" \
  --profile jameswilliams --region ap-southeast-2
```

## Adding New Parameters

1. Add the parameter/secret to `lib/ssm-params-stack.ts`
2. If CI needs access, ensure the role in `lib/github-oidc-stack.ts` has permission
3. Deploy: `npx cdk deploy SsmParams-Dev --context env=dev --profile jameswilliams`

## When to Use Which

| Scenario | Use |
|----------|-----|
| API endpoint URLs | SSM Parameter Store |
| Feature flags | SSM Parameter Store |
| Region/account config | SSM Parameter Store |
| API tokens / keys | Secrets Manager |
| Database passwords | Secrets Manager |
| OAuth client secrets | Secrets Manager |
| Anything rotatable | Secrets Manager |

## IAM Permissions

The `github-actions-jameswilliams-web` role has access to:
- `ssm:GetParameter` on `arn:aws:ssm:ap-southeast-2:986995923840:parameter/jameswilliams/*`
- `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:ap-southeast-2:986995923840:secret:jameswilliams/*`

## Naming Convention

```
/jameswilliams/{env}/{service}/{key}
```

Examples:
- `/jameswilliams/dev/webiny/api-url`
- `jameswilliams/dev/webiny/api-token`
- `/jameswilliams/prod/stripe/webhook-secret`
- `/jameswilliams/dev/app/feature-new-ui`
