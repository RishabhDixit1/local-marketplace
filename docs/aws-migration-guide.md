# ServiQ — AWS Migration Guide

## Migration from Supabase to AWS

**Budget:** $1,000 AWS credits (12-month runway target)
**Current Stack:** Supabase (Postgres + Auth + Realtime + Storage) + Vercel + Firebase + Razorpay
**Target Stack:** RDS Aurora + Cognito + API Gateway WebSockets + S3 + ECS/Amplify + Firebase + Razorpay

---

## Reference Articles

| Resource | URL |
|----------|-----|
| Supabase → AWS (Bytebase) | https://www.bytebase.com/blog/how-to-migrate-from-supabase-to-aws/ |
| PostgreSQL → RDS (AWS Docs) | https://docs.aws.amazon.com/dms/latest/sbs/dm-postgresql-step-by-step-migration.html |
| API Gateway WebSocket Chat App (AWS Docs) | https://docs.aws.amazon.com/apigateway/latest/developerguide/websocket-api-chat-app.html |
| Cognito Custom Auth (Passwordless) | https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-auth-flow.html |
| S3 Presigned URLs | https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html |
| Next.js on AWS Amplify | https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html |
| AWS Free Tier Limits | https://aws.amazon.com/free/ |

---

## Migration Strategy: Services-First

Migrate services first (Auth, Storage, Realtime), then the database last — so the final DB step is just vanilla Postgres → Postgres.

```
Phase 1:  Networking + IAM              (Day 1-2)
Phase 2:  Auth → Cognito                (Day 3-7)
Phase 3:  Storage → S3                  (Day 8-10)
Phase 4:  Hosting → Amplify / ECS       (Day 11-14)
Phase 5:  Realtime → API Gateway WS     (Day 15-21)
Phase 6:  Database → RDS Aurora         (Day 22-28)
Phase 7:  Cutover + Testing             (Day 29-30)
```

---

## Phase 1: Networking & IAM (Day 1-2)

### Step 1.1: Create VPC

```bash
# Via AWS CLI
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications \
  'ResourceType=vpc,Tags=[{Key=Name,Value=serviq-vpc}]'

# Create public subnets (for ALB, Amplify)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b

# Create private subnets (for RDS, ECS tasks)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.3.0/24 \
  --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.4.0/24 \
  --availability-zone us-east-1b

# Create Internet Gateway + attach
aws ec2 create-internet-gateway
aws ec2 attach-internet-gateway --vpc-id vpc-xxx --internet-gateway-id igw-xxx

# Create NAT Gateway (for private subnet outbound traffic)
aws ec2 allocate-address --domain vpc
aws ec2 create-nat-gateway --subnet-id subnet-public-1a \
  --allocation-id eipalloc-xxx
```

**Or use the AWS Console** (easier for beginners):
1. VPC → Create VPC → "VPC and more"
2. Name: `serviq-vpc`, CIDR: `10.0.0.0/16`
3. 2 AZs, 2 public subnets, 2 private subnets
4. 1 NAT Gateway ($) — this costs ~$32/mo, skip if budget is tight

### Step 1.2: IAM Roles

Create IAM roles for:
- **LambdaExecutionRole** — allows Lambda to write CloudWatch logs, invoke RDS, access S3
- **ECSTaskRole** — allows ECS tasks to access S3, Secrets Manager
- **CognitoAuthRole** — unauthenticated/authenticated Cognito identities

```json
// LambdaExecutionRole trust policy
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

Attach managed policies: `AWSLambdaBasicExecutionRole`, `AmazonS3FullAccess`,
`AmazonRDSDataFullAccess`, `AmazonCognitoPowerUser`.

---

## Phase 2: Auth → Cognito (Day 3-7)

This is the biggest change. ServiQ uses passwordless email magic links — Cognito supports this via a Custom Authentication flow.

### Step 2.1: Export Users from Supabase Auth

```sql
-- Run on Supabase SQL Editor to export users
SELECT
  id,
  email,
  created_at,
  raw_user_meta_data,
  confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email IS NOT NULL
ORDER BY created_at;
```

Save output as CSV.

### Step 2.2: Create Cognito User Pool

Via AWS Console:
1. Cognito → Create user pool
2. Name: `serviq-users`
3. **Sign-in options**: Email only
4. **Passwordless sign-in**: Enable "Email" (magic link)
5. **Custom email sender**: Required — SES + Lambda for sending magic links
6. **App client**: Create `serviq-web-client` (no client secret)

**Magic Link Flow (Custom Auth Challenge):**

```
User enters email
  → Lambda(DefineAuthChallenge) → respond with CUSTOM_CHALLENGE
  → Lambda(CreateAuthChallenge) → generate magic link token, send email via SES
  → User clicks link → GET /auth/callback?code=TOKEN
  → Lambda(VerifyAuthChallenge) → verify token, respond success
  → Cognito issues JWT tokens
```

Three Lambda triggers needed:

```typescript
// 1. DefineAuthChallenge Lambda
exports.handler = async (event) => {
  if (event.request.session.length === 0) {
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  } else if (
    event.request.session.slice(-1)[0].challengeResult === true
  ) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    event.response.failAuthentication = true;
  }
  return event;
};
```

```typescript
// 2. CreateAuthChallenge Lambda
const crypto = require('crypto');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

exports.handler = async (event) => {
  const secretLoginCode = crypto.randomBytes(20).toString('hex');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(secretLoginCode)
    .digest('hex');

  // Store the secret temporarily (use DynamoDB or Parameter Store)
  await saveChallenge(event.request.userAttributes.email, secretLoginCode);

  // Send magic link email via SES
  const magicLink = `https://serviq.com/auth/callback?code=${secretLoginCode}`;
  await sendEmail(event.request.userAttributes.email, magicLink);

  event.response.publicChallengeParameters = {};
  event.response.privateChallengeParameters = {
    codeChallenge: codeChallenge,
  };
  return event;
};
```

```typescript
// 3. VerifyAuthChallenge Lambda
exports.handler = async (event) => {
  const expectedCode = await getChallenge(
    event.request.userAttributes.email
  );
  event.response.answerCorrect =
    event.request.challengeAnswer === expectedCode;
  return event;
};
```

### Step 2.3: Migrate Users to Cognito

```bash
# Use AWS CLI to bulk-import users
aws cognito-idp create-user-import-job \
  --user-pool-id <pool-id> \
  --job-name "supabase-migration" \
  --cloud-watch-logs-role-arn <role-arn> \
  --input-s3-bucket serviq-cognito-import \
  --input-s3-key users.csv
```

Or simpler: use the Cognito console "Import users" feature with the CSV export.

### Step 2.4: Update Frontend Auth Code

The current `app/page.tsx` uses `supabase.auth.signInWithOtp()` for magic links.

**Replace with Amplify auth library:**

```bash
npm install aws-amplify @aws-amplify/auth
```

```typescript
// lib/cognito.ts — new auth client
import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    },
  },
});

export const sendMagicLink = (email: string) =>
  signIn({ username: email });

export const handleCustomAuthChallenge = (code: string) =>
  confirmSignIn({ challengeResponse: code });

export const getCognitoUser = () => getCurrentUser();

export const getAccessToken = async () => {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString();
};

export const logout = () => signOut();
```

Update the login page `app/page.tsx`:
- Replace `supabase.auth.signInWithOtp({ email })` → `sendMagicLink(email)`
- Replace `supabase.auth.onAuthStateChange(...)` → Cognito events
- Update session checking to use `getCurrentUser()`

**For API auth**, replace the Bearer token validation in `lib/server/requestAuth.ts`:

```typescript
// BEFORE: requireRequestAuth validates vs Supabase
const { data: { user } } = await supabase.auth.getUser(token);

// AFTER: validate Cognito JWT
import { decode, verify } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`,
});

export const verifyCognitoToken = async (token: string) => {
  const decoded = decode(token, { complete: true });
  const key = await client.getSigningKey(decoded.header.kid);
  const publicKey = key.getPublicKey();
  return verify(token, publicKey, {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
  });
};
```

### Key Files to Modify

| File | Change |
|------|--------|
| `lib/supabase.ts` | Remove or replace with Cognito client |
| `lib/server/requestAuth.ts` | Validate Cognito JWT instead of Supabase |
| `app/page.tsx` | Use Cognito magic link flow |
| `app/auth/callback/page.tsx` | Handle Cognito auth redirect |
| `app/dashboard/layout.tsx` | Use Cognito `getCurrentUser()` |
| `app/components/profile/ProfileContext.tsx` | Replace `supabase.auth.getUser()` with Cognito |

---

## Phase 3: Storage → S3 (Day 8-10)

### Step 3.1: Create S3 Buckets

```bash
aws s3 mb s3://serviq-post-media --region us-east-1
aws s3 mb s3://serviq-avatars --region us-east-1
aws s3 mb s3://serviq-listings --region us-east-1

# Block public access (use presigned URLs instead)
aws s3api put-public-access-block \
  --bucket serviq-post-media \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 3.2: Set up CORS

```json
// Bucket CORS config
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://serviqapp.com", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Step 3.3: Create Presigned URL API

```typescript
// app/api/upload/presign/route.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { requireRequestAuth } from '@/lib/server/requestAuth';

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.userId) return Response.json({ ok: false }, { status: 401 });

  const { fileName, fileType, bucket } = await request.json();

  const key = `${auth.userId}/${uuidv4()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: `serviq-${bucket}`,
    Key: key,
    ContentType: fileType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return Response.json({ ok: true, url, key });
}
```

### Step 3.4: Migrate Existing Files

```bash
# Use rclone to copy from Supabase Storage to S3
# First, download from Supabase:
# Supabase storage lives at: https://<project>.supabase.co/storage/v1/object/public/<bucket>/

# Then upload to S3:
aws s3 sync ./downloaded-files/ s3://serviq-post-media/
```

### Step 3.5: Update Upload Components

Update `ImageUploadField.tsx`, `app/api/upload/post-media/route.ts`, and `app/api/upload/listing-image/route.ts`:

```typescript
// BEFORE: supabase.storage.from("post-media").upload(path, file)
const { data } = await supabase.storage
  .from("post-media")
  .upload(`public/${userId}/${fileName}`, file);

// AFTER: S3 presigned URL
const { url, key } = await fetch("/api/upload/presign", {
  method: "POST",
  body: JSON.stringify({ fileName, fileType, bucket: "post-media" }),
}).then(r => r.json());

await fetch(url, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type },
});
```

---

## Phase 4: Hosting → Amplify / ECS (Day 11-14)

### Option A: AWS Amplify (Simpler, recommended for beginners)

Amplify is the closest to Vercel's DX.

1. Go to AWS Amplify Console → Host web app
2. Connect GitHub repo (`RishabhDixit1/local-marketplace`)
3. Branch: `main`
4. Build settings: Auto-detected (Next.js)
5. Environment variables: Add all from `.env.example` (Cognito IDs, RDS endpoint, etc.)

```yaml
# amplify.yml (auto-generated)
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

**Cost:** ~$0 (Amplify hosting is free for 1,000 build minutes/month, 5 GB storage)

### Option B: ECS Fargate (More control, can fit in $1k credits)

```dockerfile
# Dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=base /app/.next .next
COPY --from=base /app/public public
COPY --from=base /app/package.json .
COPY --from=base /app/node_modules node_modules
EXPOSE 3000
CMD ["npm", "start"]
```

**Cost:** ~$20/mo for 1 task at 0.25 vCPU + 0.5 GB RAM.

### Setup CloudFront

```bash
# Create CloudFront distribution for static assets
aws cloudfront create-distribution \
  --origin-domain-name <amplify-or-ecs-domain> \
  --default-cache-behavior '{"TargetOriginId":"serviq-origin","ViewerProtocolPolicy":"redirect-to-https","AllowedMethods":{"Quantity":2,"Items":["GET","HEAD"],"CachedMethods":{"Quantity":2,"Items":["GET","HEAD"]}},"ForwardedValues":{"QueryString":false,"Cookies":{"Forward":"none"}}}'
```

---

## Phase 5: Realtime → API Gateway WebSocket (Day 15-21)

This is the most complex migration. ServiQ uses Supabase Realtime for:
- Chat messages (`conversation-live-{id}`)
- Presence (`marketplace-global-presence`)
- Feed updates (`welcome-live-feed-{userId}`)
- Notifications (`notifications:{userId}`)

### Step 5.1: Architecture

```
Client WebSocket          API Gateway WS           Lambda                  DynamoDB
     │                        │                       │                       │
     │── wss://connect ──────►│── $connect ──────────►│── store connection ──►│
     │                        │                       │                       │
     │── {"action":"join",    │                       │                       │
     │    "room":"chat-123"}──►│── join_room ─────────►│── subscribe to room──►│
     │                        │                       │                       │
     │── {"action":"send",    │                       │                       │
     │    "room":"chat-123",  │                       │                       │
     │    "message":"hi"}────►│── send_message ──────►│── persist to RDS ────►│
     │                        │                       │── broadcast to room──►│
     │◄── {"type":"message",  │                       │                       │
     │     "data":"hi"}───────┤◄──────────────────────┤◄──────────────────────┤
```

### Step 5.2: Create WebSocket API

```bash
# Via AWS CLI
aws apigatewayv2 create-api \
  --name serviq-realtime \
  --protocol-type WEBSOCKET \
  --route-selection-expression '$request.body.action'
```

Routes:
| Route | Lambda | Purpose |
|-------|--------|---------|
| `$connect` | `ws-connect` | Validates Cognito JWT, stores connection |
| `$disconnect` | `ws-disconnect` | Removes connection, broadcasts offline |
| `$default` | `ws-default` | Handles unknown actions |
| `join_room` | `ws-join-room` | Adds connection to room group |
| `leave_room` | `ws-leave-room` | Removes connection from room |
| `send_message` | `ws-send-message` | Persists msg to RDS + broadcasts |
| `typing` | `ws-typing` | Broadcasts typing indicator |
| `presence` | `ws-presence` | Heartbeat/online update |

### Step 5.3: Connection Table (DynamoDB)

```json
{
  "connectionId": "string (PK)",
  "userId": "string (GSI-PK)",
  "rooms": "string[]",
  "connectedAt": "number (epoch ms)",
  "ttl": "number (auto-expire stale)"
}
```

### Step 5.4: Chat Message Lambda

```typescript
// lambda/send_message.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.RDS_CONNECTION_STRING });
const ddb = new DynamoDBClient({});
const api = new ApiGatewayManagementApiClient({
  endpoint: process.env.WS_ENDPOINT, // e.g., https://api-id.execute-api.us-east-1.amazonaws.com/production
});

exports.handler = async (event) => {
  const { connectionId } = event.requestContext;
  const { room, content, conversationId } = JSON.parse(event.body);
  const userId = await getUserId(connectionId, ddb);

  // 1. Persist message to RDS
  await db.query(
    `INSERT INTO messages (conversation_id, sender_id, content, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [conversationId, userId, content]
  );

  // 2. Get all connections in this room
  const connections = await getRoomConnections(room, ddb);

  // 3. Broadcast to all except sender
  const postCalls = connections
    .filter(conn => conn.connectionId !== connectionId)
    .map(conn =>
      api.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: JSON.stringify({
          type: 'message',
          conversationId,
          senderId: userId,
          content,
          timestamp: new Date().toISOString(),
        }),
      }))
    );

  await Promise.allSettled(postCalls);

  return { statusCode: 200 };
};
```

### Step 5.5: Update Frontend

Replace `supabase.channel(...)` subscriptions:

```typescript
// lib/realtime.ts — new WebSocket client
class RealtimeClient {
  private ws: WebSocket | null = null;
  private rooms: Set<string> = new Set();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  async connect() {
    const token = (await fetchAuthSession()).tokens?.accessToken?.toString();
    this.ws = new WebSocket(`wss://${process.env.NEXT_PUBLIC_WS_ENDPOINT}?token=${token}`);

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const handlers = this.listeners.get(msg.type) || new Set();
      handlers.forEach(fn => fn(msg.data));
    };
  }

  join(room: string) {
    this.rooms.add(room);
    this.ws?.send(JSON.stringify({ action: 'join_room', room }));
  }

  leave(room: string) {
    this.rooms.delete(room);
    this.ws?.send(JSON.stringify({ action: 'leave_room', room }));
  }

  send(room: string, data: any) {
    this.ws?.send(JSON.stringify({ action: 'send_message', room, ...data }));
  }

  on(type: string, handler: (data: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  off(type: string, handler: (data: any) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  disconnect() {
    this.ws?.close();
  }
}

export const realtime = new RealtimeClient();
```

Update `app/dashboard/chat/page.tsx`:

```typescript
// BEFORE:
const channel = supabase
  .channel(`conversation-live-${conversationId}`)
  .on("postgres_changes", ...)
  .subscribe();

// AFTER:
realtime.connect();
realtime.join(`chat-${conversationId}`);
realtime.on('message', handleNewMessage);
```

Update `app/dashboard/welcome/page.tsx` feed subscriptions similarly.

---

## Phase 6: Database → RDS Aurora (Day 22-28)

### Step 6.1: Create RDS Aurora Instance

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name serviq-db-subnet \
  --subnet-ids subnet-private-1a subnet-private-1b

# Create Aurora PostgreSQL cluster
aws rds create-db-cluster \
  --db-cluster-identifier serviq-aurora \
  --engine aurora-postgresql \
  --engine-version 16.4 \
  --master-username serviq_admin \
  --master-user-password <strong-password> \
  --db-subnet-group-name serviq-db-subnet \
  --vpc-security-group-ids sg-rds \
  --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=8

# Create writer instance
aws rds create-db-instance \
  --db-instance-identifier serviq-aurora-writer \
  --db-cluster-identifier serviq-aurora \
  --db-instance-class db.serverless \
  --engine aurora-postgresql
```

### Step 6.2: Export and Import Data

```bash
# 1. Export from Supabase (only public schema — auth and storage schemas retire)
pg_dump \
  --host=<supabase-db-host> \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=serviq-public.dump

# 2. Host dump file on S3
aws s3 cp serviq-public.dump s3://serviq-migration/

# 3. Import to RDS
pg_restore \
  --host=<rds-endpoint> \
  --port=5432 \
  --username=serviq_admin \
  --dbname=serviq \
  --no-owner \
  --no-acl \
  --format=custom \
  --jobs=4 \
  serviq-public.dump
```

### Step 6.3: Handle RLS Policies

Supabase RLS policies reference `auth.uid()` and `auth.jwt()` — these won't work on RDS.

**Strategy: Move authorization to the application layer.**

Before (RLS):
```sql
CREATE POLICY "Users can only see their own orders"
ON orders FOR SELECT
USING (auth.uid() = consumer_id);
```

After (Lambda):
```typescript
// In each API handler
export async function GET(request: Request) {
  const auth = await requireCognitoAuth(request);  // returns { userId }
  const { userId } = auth;

  // Authorization is in application code
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("consumer_id", userId);  // <-- explicit filter instead of RLS

  return Response.json({ ok: true, data });
}
```

**Audit all RLS policies in your codebase:**

```sql
-- Find all RLS policies on your Supabase instance
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
ORDER BY tablename;
```

Each policy must be replaced with application-level checks in the API layer.

### Step 6.4: Migrate Database Functions (RPCs)

Your `lib/server/` code calls Supabase RPCs like:
- `match_help_request(uuid)`
- `accept_help_request(uuid)`
- `get_feed_card_metrics(text[])`
- etc.

These are plain PostgreSQL functions — they work on RDS too. After restoring the dump, verify they exist:

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE specific_schema = 'public'
ORDER BY routine_name;
```

### Step 6.5: Update Connection Strings

Update these files to use RDS endpoint:

```typescript
// BEFORE: lib/supabaseServer.ts
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// AFTER: lib/rds.ts
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.RDS_HOSTNAME,          // serviq-aurora.cluster-xxx.us-east-1.rds.amazonaws.com
  port: 5432,
  database: process.env.RDS_DB_NAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
});

// Helper for querying
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}
```

---

## Phase 7: Cutover + Testing (Day 29-30)

### Step 7.1: Cutover Checklist

- [ ] All RLS policies replaced with app-level auth
- [ ] Cognito JWT validation working in all API routes
- [ ] S3 presigned URLs working for all uploads
- [ ] WebSocket connections authenticated and routing correctly
- [ ] Chat messages persisting and broadcasting
- [ ] Feed subscriptions delivering updates
- [ ] Presence tracking working
- [ ] Magic link emails sending via SES
- [ ] Database queries returning correct results
- [ ] CloudFront serving static assets
- [ ] Environment variables set on Amplify/ECS

### Step 7.2: Staging Environment

```bash
# Deploy staging stack
aws cloudformation create-stack \
  --stack-name serviq-staging \
  --template-body file://cloudformation/staging.yml
```

Test each flow:
1. Sign up with magic link → receive email → click → login
2. Create a post → see it in feed
3. Chat with another user → realtime delivery
4. Upload an image → S3 presigned URL works
5. Browse feed → pagination works
6. Create order → payment flow

### Step 7.3: Production Cutover

1. DNS: Update Route 53 `serviqapp.com` to point to new CloudFront distribution
2. Monitor CloudWatch logs for errors
3. Keep Supabase running as fallback for 48 hours
4. After validation, take final Supabase backup and stop the project

### Step 7.4: Monitoring

```bash
# Set up CloudWatch dashboards
aws cloudwatch put-dashboard \
  --dashboard-name serviq-production \
  --dashboard-body '{
    "widgets": [
      { "type": "metric", "properties": { "metrics": [ ... ] } }
    ]
  }'
```

Key metrics to monitor:
- Lambda errors and duration
- RDS connections and CPU
- API Gateway WebSocket connection count
- Cognito sign-in/sign-up counts
- S3 request metrics

---

## Environment Variables (New)

Add these to your `.env` or Amplify environment:

```
# Database
RDS_HOSTNAME=serviq-aurora.cluster-xxx.us-east-1.rds.amazonaws.com
RDS_DB_NAME=serviq
RDS_USERNAME=serviq_admin
RDS_PASSWORD=...
RDS_PORT=5432

# Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=us-east-1

# S3
NEXT_PUBLIC_S3_BUCKET_POST_MEDIA=serviq-post-media
NEXT_PUBLIC_S3_BUCKET_AVATARS=serviq-avatars
NEXT_PUBLIC_S3_BUCKET_LISTINGS=serviq-listings
AWS_REGION=us-east-1

# WebSocket
NEXT_PUBLIC_WS_ENDPOINT=api-id.execute-api.us-east-1.amazonaws.com/production

# CloudFront
NEXT_PUBLIC_CDN_URL=https://xxxxx.cloudfront.net

# Keep these (no AWS equivalent needed)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=...
FIREBASE_PROJECT_ID=serviq-staging
FIREBASE_SERVICE_ACCOUNT_JSON={...}
```

---

## Cost Tracking ($1k Credit Budget)

| Service | Monthly | 12 Months | Notes |
|---------|---------|-----------|-------|
| RDS Aurora Serverless v2 (0.5-4 ACU) | ~$20 | $240 | Scale to 0 when idle |
| Cognito (50k MAU free) | $0 | $0 | Free tier up to 50k users |
| S3 (10GB + 10k requests) | ~$3 | $36 | |
| API Gateway WS (1M msgs) | ~$2 | $24 | |
| DynamoDB (on-demand, 1GB) | ~$2 | $24 | |
| Lambda (1M invocations) | ~$2 | $24 | Free tier covers first 1M |
| Amplify Hosting | $0 | $0 | Free tier |
| CloudFront (1TB free) | $0 | $0 | Free tier first 1TB |
| SES (62k emails/mo free) | $0 | $0 | Free from EC2 |
| Route 53 | ~$0.50 | $6 | |
| **Total** | **~$30** | **~$360** | **$640 remaining for extras** |

---

## Rollback Plan

If something goes wrong during cutover:

1. **DNS rollback**: Point Route 53 back to Vercel
2. **Database**: RDS keeps the migrated data; Supabase still has all data until decommissioned
3. **Auth**: Cognito users can be re-exported; Supabase auth still functional
4. **Storage**: S3 files stay; Supabase storage still has originals

Keep Supabase running for 72 hours post-cutover before decommissioning.
