# Fan Accounts — Phase 2: Email Notifications

Deploy these resources when ready to add release notifications and branded transactional emails.

---

## Overview

Phase 2 adds:
- SES domain verification and DKIM for `jameswilliams.com.au`
- Email templates (welcome, release notification, blog, account deleted)
- Bounce/complaint handling via SNS → Lambda
- SQS queue for decoupled fan-out email dispatch
- CloudWatch alarms for SES metrics
- SendGrid fallback option

---

## 1. Amazon SES

| Setting | Value |
|---------|-------|
| Region | `ap-southeast-2` |
| Verified Identity | Domain: `jameswilliams.com.au` |
| DKIM | Enabled (EASY DKIM via Route 53) |
| DMARC | `v=DMARC1; p=quarantine; rua=mailto:dmarc@jameswilliams.com.au` |
| SPF | Included via SES DNS records |
| Configuration Set | `jameswilliams-fan-notifications` |
| Sending rate | Request production access (out of sandbox) |

---

## 2. Email Templates

| Template Name | Purpose |
|---------------|---------|
| `fan-welcome` | Welcome email after verification |
| `fan-release-notification` | New song/album notification |
| `fan-blog-notification` | New exclusive blog post |
| `fan-account-deleted` | Deletion confirmation |

---

## 3. Bounce & Complaint Handling

| Resource | Purpose |
|----------|---------|
| SNS Topic: `ses-bounces` | Receives bounce notifications |
| SNS Topic: `ses-complaints` | Receives complaint notifications |
| Lambda: `ses-feedback-handler` | Processes bounces/complaints, updates suppression list in DynamoDB |

---

## 4. SQS Email Dispatch Queue

| Setting | Value |
|---------|-------|
| Queue Name | `{env}-fan-email-dispatch` |
| Visibility Timeout | 60 seconds |
| Max Receive Count | 3 (then → DLQ) |
| DLQ Name | `{env}-fan-email-dispatch-dlq` |
| DLQ Retention | 14 days |

### Email Consumer Lambda

| Setting | Value |
|---------|-------|
| Trigger | SQS (batch size 10) |
| Reserved Concurrency | 5 (stay within SES rate limits) |
| Purpose | Read messages from queue, send via SES |

### Why a queue?

- Release notifications fan out to many subscribers — don't block the API request
- SES rate limits are naturally respected via concurrency cap
- Automatic retries on transient failures
- DLQ captures permanently failed messages for debugging

---

## 5. Additional IAM Permissions

Add to the Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": [
    "ses:SendEmail",
    "ses:SendTemplatedEmail"
  ],
  "Resource": "arn:aws:ses:ap-southeast-2:986995923840:identity/jameswilliams.com.au"
}
```

Add to the email consumer Lambda:

```json
{
  "Effect": "Allow",
  "Action": [
    "ses:SendTemplatedEmail"
  ],
  "Resource": "arn:aws:ses:ap-southeast-2:986995923840:identity/jameswilliams.com.au"
}
```

Grant the main Lambda `sqs:SendMessage` on the dispatch queue.

---

## 6. Additional SSM Parameters

| Parameter | Path |
|-----------|------|
| SES From Address | `/jameswilliams/{env}/ses/from-address` |
| SES Config Set | `/jameswilliams/{env}/ses/config-set-name` |
| Email Queue URL | `/jameswilliams/{env}/sqs/email-dispatch-queue-url` |

---

## 7. Additional Lambda Environment Variables

```
SES_FROM_ADDRESS=notifications@jameswilliams.com.au
SES_REGION=ap-southeast-2
SES_CONFIG_SET=jameswilliams-fan-notifications
EMAIL_QUEUE_URL=<from SSM>
EMAIL_PROVIDER=ses
```

---

## 8. CloudWatch Alarms (SES-specific)

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| SES Bounce Rate | `Bounce` | > 5% over 1 hour | SNS → Ops email |
| SES Complaint Rate | `Complaint` | > 0.1% over 1 hour | SNS → Ops email |
| Bounce Handler Errors | Lambda `Errors` | > 0 in 5 min | SNS → Ops email |
| Email DLQ Depth | `ApproximateNumberOfMessagesVisible` | > 0 | SNS → Ops email |

---

## 9. CDK Stack Additions

```
lib/
├── constructs/
│   ├── fan-ses.ts                 # SES domain, templates, feedback
│   ├── fan-email-queue.ts         # SQS queue + DLQ + consumer Lambda
│   └── fan-monitoring.ts          # CloudWatch alarms (extended for SES)
```

---

## 10. SendGrid Fallback (Alternative)

If SES sandbox limits are restrictive or sending volume needs a dedicated IP:

| Setting | Value |
|---------|-------|
| API Key Storage | Secrets Manager: `jameswilliams/{env}/fan-accounts/sendgrid-api-key` |
| Sender Identity | `notifications@jameswilliams.com.au` |
| IP Pool | Shared (upgrade to dedicated if volume > 50k/month) |
| Webhooks | Bounce/complaint webhooks → API Gateway → Lambda |

The application uses an `EMAIL_PROVIDER` env var (`ses` or `sendgrid`) to switch transport without code changes.

---

## Prerequisites Before Phase 2

- [ ] James has purchased/configured `jameswilliams.com.au` domain
- [ ] DNS is managed (Route 53 or external with access to add records)
- [ ] Phase 1 is deployed and stable
- [ ] SES production access requested (takes ~24 hours approval)
