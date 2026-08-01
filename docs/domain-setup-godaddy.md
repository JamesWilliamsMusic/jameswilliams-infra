# Domain Setup: jameswilliamsmusic.store (GoDaddy)

## Overview

The prod stack creates an ACM certificate in `us-east-1` for `jameswilliamsmusic.store` and `www.jameswilliamsmusic.store`, then attaches both as alternate domain names on the CloudFront distribution.

Since DNS is managed on GoDaddy (not Route 53), there are manual steps required after deploying.

---

## Deploy Steps

### 1. Deploy the certificate stack first

```bash
npx cdk deploy prod-certificate --context env=prod
```

This will **hang** waiting for DNS validation. That's expected — move to step 2 while it waits.

### 2. Add DNS validation CNAME records on GoDaddy

1. Go to AWS Console → **Certificate Manager** → region **us-east-1**
2. Find the certificate for `jameswilliamsmusic.store`
3. Under "Domains", you'll see two CNAME records needed for validation
4. On GoDaddy DNS management for `jameswilliamsmusic.store`, add those CNAME records:
   - **Name**: the part before `.jameswilliamsmusic.store` (GoDaddy auto-appends the domain)
   - **Value**: the full CNAME target value from ACM

> Example: If ACM shows `_abc123.jameswilliamsmusic.store` → `_xyz789.acm-validations.aws`, add a CNAME with name `_abc123` and value `_xyz789.acm-validations.aws.`

5. Wait for ACM to show "Issued" status (can take 5–30 minutes)
6. The `cdk deploy` command will complete once validation succeeds

### 3. Deploy the main infrastructure stack

```bash
npx cdk deploy prod-music-portfolio --context env=prod
```

### 4. Point domain to CloudFront on GoDaddy

After deploy, get the CloudFront distribution domain name from the stack outputs (e.g. `d1abc2def3g4h5.cloudfront.net`).

On GoDaddy, add these DNS records:

| Type | Name | Value |
|------|------|-------|
| CNAME | www | `d1abc2def3g4h5.cloudfront.net` |
| Forwarding | @ (apex) | Forward to `https://www.jameswilliamsmusic.store` |

**Why forwarding for apex?** GoDaddy doesn't support ALIAS/ANAME records, so the naked domain (`jameswilliamsmusic.store`) can't CNAME directly to CloudFront. Use GoDaddy's domain forwarding (301 redirect) to send apex traffic to `www`.

Alternatively, if you want the apex as the primary:
- Use GoDaddy forwarding on `www` → `https://jameswilliamsmusic.store`
- Point apex using GoDaddy's "A record with flattening" if available, or transfer DNS to Route 53

---

## Verifying

```bash
# Check www resolves
dig www.jameswilliamsmusic.store CNAME

# Check HTTPS works
curl -I https://www.jameswilliamsmusic.store
```

---

## Troubleshooting

- **Certificate stuck in "Pending validation"**: Double-check the CNAME records on GoDaddy. Make sure you didn't include the domain suffix in the name field (GoDaddy appends it automatically).
- **CloudFront returns 403 after adding domain**: The certificate might not be validated yet, or the domain names on the distribution don't match what's being requested.
- **Mixed content / redirect loops**: Ensure the CloudFront viewer protocol policy is set to "Redirect HTTP to HTTPS" (already configured in CDK).
