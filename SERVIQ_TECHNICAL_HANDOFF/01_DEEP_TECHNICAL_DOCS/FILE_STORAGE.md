# ServiQ File Storage

## 1. Supabase Storage Buckets

### 1.1 Bucket Overview

| Bucket | Max Size | Access | Path Pattern | Use |
|--------|----------|--------|-------------|-----|
| post-media | 25MB | Public | `posts/{user_id}/` | Feed post images/videos |
| profile-avatars | 5MB | Public | `avatars/{user_id}/` | Profile pictures |
| listing-images | No explicit limit | Public | `{user_id}/` | Service/product listing photos |
| review-photos | 10MB | Public | `reviews/{user_id}/` | Review attachment photos |
| chat-media | 5MB | Public | `chat/{conversation_id}/` | Chat image attachments |

### 1.2 Bucket Configuration
```sql
-- Created via Supabase dashboard or migrations
-- post-media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  26214400,  -- 25MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
);

-- profile-avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- listing-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  10485760,  -- 10MB (default)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- review-photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-photos',
  'review-photos',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- chat-media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);
```

---

## 2. RLS Policies

### 2.1 Public Read
All buckets have public read access (objects are publicly accessible via URL):
```sql
-- Anyone can read objects in public buckets
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id IN ('post-media', 'profile-avatars', 'listing-images', 'review-photos', 'chat-media'));
```

### 2.2 Authenticated Upload
```sql
-- Users can upload to their own folder
CREATE POLICY "Users upload to own folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('post-media', 'profile-avatars', 'listing-images', 'review-photos', 'chat-media')
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );
```

### 2.3 Own-Object Delete
```sql
-- Users can delete their own objects
CREATE POLICY "Users delete own objects" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('post-media', 'profile-avatars', 'listing-images', 'review-photos', 'chat-media')
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );
```

### 2.4 Admin Policies
```sql
-- Admins can manage all objects
CREATE POLICY "Admins manage all objects" ON storage.objects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

---

## 3. Upload Flow

### 3.1 Server-Side Upload (Web)
```
1. Client selects file
   └── File input or drag-and-drop

2. Client compression (optional)
   ├── lib/clientImageCompression.ts
   ├── Converts to WebP
   ├── Reduces dimensions (max 1024px)
   └── Quality reduction (0.78 → 0.5)

3. Upload to API route
   ├── POST /api/upload/post-media (or chat-media, listing-image, etc.)
   ├── FormData with 'file' field
   └── Server validates: size, content-type

4. Server uploads to Supabase Storage
   ├── lib/server/fileValidation.ts checks file
   ├── supabase.storage.from(bucket).upload(path, file, options)
   ├── Path: {folder}/{user_id}/{timestamp}_{random}.{ext}
   └── Returns: public URL

5. Return URL to client
   └── { ok: true, url: "https://xxx.supabase.co/storage/v1/object/public/bucket/path" }
```

### 3.2 Client-Side Upload (Mobile)
```
1. Image picker
   ├── image_picker plugin (camera or gallery)
   └── Returns XFile

2. Client compression
   ├── Flutter image compression plugin
   └── Max dimension + quality reduction

3. Upload to Supabase Storage
   ├── supabase.storage.from('post-media').upload(path, file)
   └── Returns: path string

4. Get public URL
   └── supabase.storage.from('post-media').getPublicUrl(path)
```

### 3.3 File Validation
```typescript
// lib/server/fileValidation.ts
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'video/mp4', 'video/quicktime',
]);

const BUCKET_LIMITS: Record<string, number> = {
  'post-media': 25 * 1024 * 1024,      // 25MB
  'profile-avatars': 5 * 1024 * 1024,   // 5MB
  'listing-images': 10 * 1024 * 1024,   // 10MB
  'review-photos': 10 * 1024 * 1024,    // 10MB
  'chat-media': 5 * 1024 * 1024,        // 5MB
};

function validateFile(file: File, bucket: string): void {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Invalid file type');
  if (file.size > (BUCKET_LIMITS[bucket] || 10 * 1024 * 1024)) {
    throw new Error('File too large');
  }
}
```

---

## 4. Image Proxy

### 4.1 Next.js Image Optimization
- **File:** `lib/server/imageProxy.ts`
- **Pattern:** Supabase Storage URLs proxied through `/_next/image`
- **Benefits:** WebP conversion, responsive sizing, CDN caching

### 4.2 Proxy URL Construction
```typescript
buildNextImageProxyUrl(value, { origin, width, quality }) → string

// Input: https://xxx.supabase.co/storage/v1/object/public/post-media/xxx/photo.jpg
// Output: https://www.serviqapp.com/_next/image?url=https://...&w=640&q=70
```

### 4.3 Proxy Rules
- **Proxyable:** URLs matching `/storage/v1/object/public/` or `/storage/v1/render/image/public/`
- **Proxyable extensions:** `.avif`, `.jpg`, `.jpeg`, `.png`, `.webp`
- **Not proxied:** `/_next/image` URLs (avoid double proxy), localhost URLs
- **Size variants:**
  - Avatar: 96px width, 70% quality
  - Preview: 640px width, 70% quality

### 4.4 Applied To
- `proxyCommunityFeedImages()` — feed card thumbnails + avatars
- `proxyCommunityPeopleImages()` — people card images
- `proxyFeedItem()` — individual feed item images
- `proxyProfile()` — profile avatar URLs

---

## 5. Storage URLs

### 5.1 Public URL Format
```
https://{project-ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
```

### 5.2 Image Rendering URL
```
https://{project-ref}.supabase.co/storage/v1/render/image/public/{bucket}/{path}?width=640&quality=70
```

### 5.3 Next.js Proxy URL
```
https://www.serviqapp.com/_next/image?url={encoded_supabase_url}&w=640&q=70
```

### 5.4 Mobile URL Handling
- Mobile uses raw Supabase Storage URLs (no proxy)
- `CachedNetworkImage` widget handles caching + loading states
- Fallback: `AppAvatar` with initials on load failure
