import { query } from "./db.js";
import { logger } from "../lib/logger.js";

const sampleCategories = [
  { slug: "general", name: "General Discussion", description: "A place for general discussion and community topics." },
  { slug: "q-and-a", name: "Q&A", description: "Ask questions and get answers from the community." },
  { slug: "showcase", name: "Showcase", description: "Share your projects and get feedback from the community." },
  { slug: "help", name: "Help", description: "Get help with using the platform or troubleshooting issues." },
  { slug: "react", name: "React & Frontend", description: "Modern UI engineering, Next.js, and state management." },
  { slug: "nodejs", name: "Node.js & Backend", description: "Server-side JavaScript, Express, APIs, and microservices." },
  { slug: "system-design", name: "System Design", description: "Distributed systems, database optimization, and scalability." },
];

const sampleThreads = [
  {
    categorySlug: "system-design",
    title: "How We Scaled Socket.IO for 100k Concurrent Real-Time Connections",
    body: `### Overview

Scaling real-time WebSocket infrastructures presents unique challenges around memory utilization, sticky sessions, and event broadcasting across node clusters.

#### Key Strategies Implemented:

1. **Redis Pub/Sub Adapter**: Decoupled socket instances using the redis-adapter so events emitted on Node Server A reach subscribers connected to Node Server B.
2. **Heartbeat Tuning**: Set \`pingInterval: 25000\` and \`pingTimeout: 20000\` to minimize unnecessary keep-alive traffic while maintaining active connection status.
3. **Binary Serialization**: Swapped JSON payloads with MessagePack binary framing for high-frequency chat events, reducing network overhead by **42%**.

\`\`\`typescript
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
\`\`\`

What optimizations have you found most effective when scaling WebSockets in production?`,
  },
  {
    categorySlug: "react",
    title: "Optimizing Next.js App Router Performance: Server Components vs Client Hooks",
    body: `The paradigm shift to **React Server Components (RSC)** in Next.js 14/15 requires a clear separation between data-fetching logic and client-side interactivity.

### Rule of Thumb

* **Server Components (Default)**: Fetch data directly from DB or external APIs, keep heavy dependencies on the server, reduce bundle size.
* **Client Components (\`"use client"\`)**: Use only at leaves of the component tree for state (\`useState\`), side-effects (\`useEffect\`), and DOM listeners.

#### Example Pattern:

\`\`\`tsx
// Server Component (Page)
import ThreadList from "@/components/ThreadList";
import { db } from "@/lib/db";

export default async function Page() {
  const threads = await db.threads.findMany();
  return <ThreadList initialData={threads} />;
}
\`\`\`

What is your preferred pattern for optimistic updates when mixing RSC with Socket.IO?`,
  },
  {
    categorySlug: "nodejs",
    title: "Building Production-Grade Express Rate Limiting with Redis & Sliding Windows",
    body: `Rate limiting is essential to protect public APIs against brute-force attacks and DDOS traffic.

### Why Token Bucket & Sliding Window?

Standard fixed-window algorithms suffer from "burst at boundary" vulnerabilities. A **Sliding Window Counter** using Redis hashes ensures uniform rate enforcement across rolling 60-second windows.

#### Implementation Highlights:
* Configured 100 requests/minute for general API routes.
* Configured 20 requests/minute for sensitive actions (auth, post thread, delete message).
* Returned standard \`RateLimit-Limit\`, \`RateLimit-Remaining\`, and \`RateLimit-Reset\` response headers.

Share your experience with rate limiting in API Gateways vs Node.js middleware!`,
  },
  {
    categorySlug: "showcase",
    title: "Showcase: ThreadStream — Full-Stack Real-Time Microservice Chat Platform",
    body: `Excited to showcase **ThreadStream**, a modern real-time communication platform built with:

* **Frontend**: Next.js 16, Tailwind CSS, Lucide Icons, Shadcn UI
* **Backend**: Node.js, Express, Socket.IO, PostgreSQL (Neon)
* **Auth**: Clerk OAuth with Google integration
* **Storage**: Cloudinary for instant image attachment uploads

### Features Built:
- Live typing indicators & presence tracking
- Full markdown rendering in threads & replies
- Instant read receipts (seen/delivered ticks)
- Per-conversation unread message badges
- Glassmorphic dark/light UI design system

Feedback and star contributions are welcome! What feature should we build next?`,
  },
  {
    categorySlug: "q-and-a",
    title: "PostgreSQL tsvector Full-Text Search vs Elasticsearch for Medium Apps?",
    body: `When building search features for application threads and messages, when should you stick with **PostgreSQL Full-Text Search (\`tsvector\`)** versus introducing a separate **Elasticsearch / Meilisearch** cluster?

### PostgreSQL FTS Pros:
- Zero additional infrastructure complexity.
- Transactional consistency with core database records.
- Built-in ranking with \`ts_rank\` and stemming dictionary support.

### Elasticsearch Pros:
- Superior fuzzy matching and multi-language tokenization.
- Horizontal scalability across huge log corpora.

What has been your experience transitioning from Postgres search to dedicated search engines?`,
  },
  {
    categorySlug: "database",
    title: "Preventing N+1 Queries in Relational Database Schema Design",
    body: `N+1 query bottlenecks frequently cripple backend response times when rendering feed endpoints with nested user and reply metadata.

### Solution: SQL Join Aggregations

Instead of looping over threads and executing single SELECT queries for author profiles, use \`JOIN\` statements with aggregated fields:

\`\`\`sql
SELECT 
  t.id, 
  t.title, 
  t.created_at,
  u.display_name AS author_name,
  u.handle AS author_handle,
  COUNT(r.id)::int AS reply_count
FROM threads t
JOIN users u ON u.id = t.author_user_id
LEFT JOIN thread_replies r ON r.thread_id = t.id
GROUP BY t.id, u.id
ORDER BY t.created_at DESC;
\`\`\`

This reduces SQL round-trips from **N+1 down to a single query**.`,
  },
  {
    categorySlug: "general",
    title: "Best Practices for Handling WebSockets Disconnections & Reconnections gracefully",
    body: `Network blips, mobile network handoffs, and deployment restarts require robust client-side reconnection strategies for real-time apps.

### Recommendations:
1. **Exponential Backoff**: Avoid hammering servers simultaneously when recovering from an outage.
2. **Message Queuing**: Buffer outbound client messages during disconnection and flush upon \`connect\` event.
3. **Idempotent Delivery**: Assign unique client message UUIDs to avoid duplicate message insertions if an ACK is dropped.

How do you handle offline status indicators in your UI?`,
  },
  {
    categorySlug: "help",
    title: "How to handle JWT token refresh securely in Next.js App Router?",
    body: `I'm building authentication with Clerk / custom JWTs and want to clarify the best pattern for handling expired tokens without interrupting active user chat sessions.

Currently, we pass short-lived bearer tokens to Socket.IO handshake auth:

\`\`\`typescript
const socket = io(SERVER_URL, {
  auth: async (cb) => {
    const token = await getToken();
    cb({ token });
  }
});
\`\`\`

If the token expires during a 2-hour active session, how should Socket.IO request a token refresh seamlessly without dropping the WebSocket connection?`,
  },
  {
    categorySlug: "react",
    title: "Mastering Tailwind CSS Design Systems: Custom Utilities & Glassmorphism",
    body: `Modern web interfaces demand rich, tactile visuals to stand out to recruiters and users alike.

### Key CSS Ingredients Used in ThreadStream:
- **Glassmorphism**: \`backdrop-filter: blur(16px)\` combined with semi-transparent HSL border tokens.
- **Micro-Animations**: Keyframe pulses on notification badges and smooth hover lift transitions on thread cards.
- **Dynamic Themes**: CSS custom properties integrated with Next-Themes for instantaneous dark/light mode switching.

What CSS techniques have elevated your frontend portfolio projects the most?`,
  },
  {
    categorySlug: "nodejs",
    title: "Structured Logging and Observability with Winston & Morgan in Microservices",
    body: `Console.log statements are insufficient for monitoring microservices in production.

### Structured JSON Logging:
By formatting log outputs as JSON objects with timestamps, request IDs, and stack traces, logs can easily be ingested by Datadog, Grafana Loki, or AWS CloudWatch.

\`\`\`typescript
import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});
\`\`\`

How do you structure your log correlation IDs across microservice boundaries?`,
  },
];

async function seed() {
  logger.info("Starting database seed...");

  // 1. Ensure categories exist
  for (const cat of sampleCategories) {
    await query(
      `INSERT INTO categories (slug, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [cat.slug, cat.name, cat.description]
    );
  }
  logger.info("Categories verified.");

  // 2. Fetch existing users
  const usersRes = await query<{ id: number; handle: string; display_name: string }>(
    `SELECT id, handle, display_name FROM users ORDER BY id ASC`
  );

  if (usersRes.rows.length === 0) {
    logger.error("No users found in database. Please log in at least once via Clerk so a user record is created.");
    process.exit(1);
  }

  const users = usersRes.rows;
  logger.info(`Found ${users.length} registered user(s): ${users.map(u => u.handle || u.display_name || u.id).join(", ")}`);

  // 3. Get category map (slug -> id)
  const catRes = await query<{ id: number; slug: string }>(`SELECT id, slug FROM categories`);
  const catMap = new Map<string, number>();
  for (const row of catRes.rows) {
    catMap.set(row.slug, Number(row.id));
  }

  // 4. Insert threads distributed among users
  let insertedCount = 0;
  for (let i = 0; i < sampleThreads.length; i++) {
    const t = sampleThreads[i];
    const categoryId = catMap.get(t.categorySlug) || catMap.get("general");
    const authorUser = users[i % users.length];

    if (!categoryId || !authorUser) continue;

    // Check if thread with same title already exists
    const check = await query(`SELECT id FROM threads WHERE title = $1`, [t.title]);
    if (check.rows.length > 0) {
      logger.info(`Thread "${t.title.slice(0, 30)}..." already exists, skipping.`);
      continue;
    }

    await query(
      `INSERT INTO threads (category_id, author_user_id, title, body, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW() - ($5 || ' hours')::interval, NOW())`,
      [categoryId, authorUser.id, t.title, t.body, (sampleThreads.length - i) * 3]
    );
    insertedCount++;
  }

  logger.info(`Successfully seeded ${insertedCount} new threads attributed to logged-in user(s)!`);
  process.exit(0);
}

seed().catch((err) => {
  logger.error("Error seeding database: " + err);
  process.exit(1);
});
