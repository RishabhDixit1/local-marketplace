# ServiQ Chat Architecture

## 1. Conversation Model

### 1.1 Conversation Types
```typescript
type ConversationType = "direct" | "group";

// Direct: 1:1 conversations between two users
// Group: Multi-user conversations (not actively used yet)
```

### 1.2 Schema
```sql
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct',  -- 'direct' | 'group'
  direct_key text UNIQUE,               -- for dedup on direct conversations
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
```

### 1.3 Direct Key (Deduplication)
- **Function:** `make_direct_conversation_key(uuid, uuid)` — sorts two user IDs, concatenates with colon
- **Purpose:** Ensures only one direct conversation exists between any two users
- **Constraint:** `conversations.direct_key` has UNIQUE index
- **Example:** `make_direct_conversation_key('user-a', 'user-b')` → `'user-a:user-b'` (sorted)

### 1.4 Conversation Creation
- **RPC:** `get_or_create_direct_conversation(uuid)` — atomic get-or-create
- **API:** `POST /api/chat/direct` with `{ recipientId: string }`
- **Flow:**
  1. Check if direct conversation exists via `direct_key` lookup
  2. If not, create `conversations` row with `direct_key`
  3. Create `conversation_participants` rows for both users
  4. Return `conversationId` + `isNew` flag

---

## 2. Message Model

### 2.1 Schema
```sql
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text,                          -- text content (can be empty for image-only)
  metadata jsonb DEFAULT '{}',           -- { imageUrl?: string, ... }
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);
```

### 2.2 Message Types
```typescript
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;          // Text content (may be empty for image-only messages)
  metadata: {
    imageUrl?: string;      // Image attachment URL
    [key: string]: unknown;
  };
  created_at: string;
};
```

### 2.3 Image Attachments
- **Upload:** `POST /api/upload/chat-media` → stores in `chat-media` bucket
- **Storage:** Metadata stored in `messages.metadata.imageUrl`
- **Display:** Empty `content` + `metadata.imageUrl` → shows as "Photo" in conversation preview
- **Proxy:** Image URLs proxied through `/_next/image` for optimization

### 2.4 Content Moderation
- Messages pass through `lib/ai/contentModeration.ts` before insertion
- Profanity: redacted with `[redacted]`
- Phone numbers: redacted
- Email addresses: redacted
- URL-only messages: blocked
- Repetitive spam: blocked

---

## 3. Connection-Gated vs Open Chat

### 3.1 Original Model (Pre-March 2026)
- Chat required an accepted connection between users
- `lib/server/chatGuards.ts` enforced connection check
- Users had to send/connect → accept → then chat

### 3.2 Current Model (Post-March 2026)
- **Relaxed March 2026:** Direct chat is now open without connection requirement
- **Migration:** `20260329145500_allow_direct_chat_without_connection.sql`
- **Guard:** `lib/server/chatGuards.ts` still exists but connection check is optional
- **Effect:** Any authenticated user can start a direct conversation with any other user

### 3.3 Connection-Gated Operations
Some operations still require connection:
- **Quote room:** Both parties must be connected for full deal room features
- **Workspace invite:** Requires connection or workspace membership
- **Block check:** Blocked users cannot chat (checked in `lib/server/chatGuards.ts`)

### 3.4 Block Prevention
- `POST /api/block` creates `blocked_users` row
- Chat guard checks `is_connection_accepted()` and block status
- Blocked users cannot see each other's profiles or send messages

---

## 4. Read Receipts

### 4.1 Implementation
- **Column:** `conversation_participants.last_read_at` (timestamptz)
- **Update:** On message send, sender's `last_read_at` is updated to `now()`
- **Read:** On conversation open, viewer's `last_read_at` is updated to `now()`
- **Unread count:** Messages where `created_at > conversation_participants.last_read_at`

### 4.2 Unread Count Calculation
```sql
-- Messages unread by a user in a conversation
SELECT COUNT(*)
FROM messages m
JOIN conversation_participants cp
  ON cp.conversation_id = m.conversation_id
  AND cp.user_id = :userId
WHERE m.created_at > cp.last_read_at
  AND m.sender_id != :userId;
```

### 4.3 Realtime Unread Updates
- Client subscribes to `messages` table changes via Supabase Realtime
- On new message: increment unread count badge
- On conversation open: mark as read (update `last_read_at`)

---

## 5. Realtime Updates

### 5.1 Realtime Publication
All chat-related tables are in the Supabase Realtime publication:
- `messages` — new messages appear in real-time
- `conversation_participants` — read receipts update in real-time
- `conversations` — new conversations appear in real-time

### 5.2 Client Subscription Pattern (Flutter)
```dart
supabase
  .from('messages')
  .stream(primaryKey: ['id'])
  .eq('conversation_id', conversationId)
  .order('created_at')
  .listen((messages) {
    // Update UI with new messages
  });
```

### 5.3 Client Subscription Pattern (Web)
```typescript
const channel = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    // Handle new message
  })
  .subscribe();
```

### 5.4 Reconnection Strategy
- **Exponential backoff:** 5s → 10s → 20s → 40s → 60s (max)
- **Max retries:** 20
- **Offline fail-fast:** Network calls check connectivity before attempting
- **Reconnect on recovery:** Automatic when connectivity restored

---

## 6. Image Attachments

### 6.1 Upload Flow
```
1. User selects image
   ├── Mobile: image_picker plugin
   └── Web: File input

2. Client compression (optional)
   ├── lib/clientImageCompression.ts
   ├── Max dimension: configurable (default 1024px)
   ├── Quality: 0.78 → 0.68 → 0.58 → 0.5
   └── Output: WebP format

3. Upload to Supabase Storage
   ├── POST /api/upload/chat-media
   ├── Bucket: chat-media (or review-photos)
   ├── Path: chat/{conversation_id}/{timestamp}_{random}.webp
   └── Max size: 5MB

4. Send message with image
   ├── POST /api/chat/messages
   ├── Body: { conversationId, content: "", metadata: { imageUrl: url } }
   └── Message stored with empty content + imageUrl in metadata
```

### 6.2 Display Logic
```dart
// In chat bubble widget
if (message.content.isEmpty && message.metadata['imageUrl'] != null) {
  // Render image bubble
  CachedNetworkImage(url: message.metadata['imageUrl']);
} else {
  // Render text bubble
  Text(message.content);
}
```

### 6.3 Conversation Preview
- Image-only messages (empty content, imageUrl set) show "Photo" in conversation list
- Text messages show first 50 chars of content
- Empty messages show "Start the conversation"

---

## 7. Web vs Mobile Chat Differences

### 7.1 Web Chat
- **Location:** `/dashboard/chat` (inside AppShell)
- **Layout:** Split view — conversation list + message thread
- **Realtime:** Supabase Realtime via JS client
- **Image upload:** Browser file input → client compression → upload
- **Read receipts:** Updated on conversation focus
- **Push notifications:** Web Push API (VAPID)

### 7.2 Mobile Chat
- **Location:** `/app/chat` (GoRouter route, top-level for deep linking)
- **Layout:** Full-screen conversation list → full-screen message thread
- **Realtime:** Supabase Flutter SDK `.stream()`
- **Image upload:** image_picker → optional compression → upload
- **Read receipts:** Updated on conversation open
- **Push notifications:** FCM (Firebase Cloud Messaging)
- **Keyboard handling:** Dismiss on scroll, auto-scroll to bottom on new message
- **Haptic feedback:** On message send

### 7.3 Shared Behavior
- **Message ordering:** `created_at` ascending
- **Pagination:** Cursor-based (load older messages on scroll up)
- **Typing indicators:** Not implemented (planned)
- **Message deletion:** Not implemented (planned)
- **Message editing:** Not implemented (planned)

### 7.4 Deep Linking
- **Web:** `/dashboard/chat?open={conversationId}`
- **Mobile:** `/app/chat/thread/{conversationId}`
- **Notification tap:** Routes to chat with conversation focused
- **Push data:** `{ url: "/dashboard/chat?open={conversationId}" }`
