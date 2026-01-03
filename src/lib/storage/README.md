# STORAGE ABSTRACTION LAYER

**Purpose:** S3-compatible storage interface for OmniHub
**Status:** ✅ Implemented (Week 2, Phase 1)
**Current Provider:** Supabase Storage
**Future Providers:** AWS S3, Google Cloud Storage, Azure Blob Storage, Cloudflare R2

---

## OVERVIEW

This abstraction layer provides an S3-compatible interface that reduces vendor lock-in risk and enables easy migration between cloud storage providers.

**Benefits:**
- ✅ **Portability:** Switch storage providers with minimal code changes
- ✅ **S3-Compatible API:** Industry-standard interface
- ✅ **Type Safety:** Full TypeScript support
- ✅ **Simple Interface:** Upload, download, delete, list - that's it
- ✅ **Future-Proof:** Add new providers without changing application code

**Current Lock-in Risk:** HIGH → MEDIUM (after abstraction layer)

---

## QUICK START

### Upload File

```typescript
import { storage } from '@/lib/storage'

const { data: url, error } = await storage.upload(
  'avatars',
  `${userId}/profile.jpg`,
  fileBlob,
  { contentType: 'image/jpeg' }
)

if (error) {
  console.error('Upload failed:', error)
  return
}

console.log('File uploaded:', url)
```

### Download File

```typescript
const { data: blob, error } = await storage.download(
  'avatars',
  `${userId}/profile.jpg`
)

if (blob) {
  const url = URL.createObjectURL(blob)
  // Display image...
}
```

---

## API REFERENCE

### Bucket Operations

#### `createBucket(name, options?)`
Create a new storage bucket.

```typescript
const { data: success, error } = await storage.createBucket('avatars', {
  public: true
})
```

#### `deleteBucket(name)`
Delete a bucket (must be empty).

```typescript
const { data: success, error } = await storage.deleteBucket('old-bucket')
```

#### `listBuckets()`
List all buckets.

```typescript
const { data: buckets, error } = await storage.listBuckets()
console.log('Buckets:', buckets) // ['avatars', 'documents', 'images']
```

---

### File Operations

#### `upload(bucket, path, file, options?)`
Upload a file to storage.

```typescript
const { data: url, error } = await storage.upload(
  'avatars',
  `${userId}/profile.jpg`,
  fileBlob,
  {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: true, // Overwrite if exists
    metadata: { uploadedBy: userId }
  }
)
```

**Options:**
- `contentType`: MIME type (e.g., `image/jpeg`, `application/pdf`)
- `cacheControl`: Cache duration in seconds (default: `3600`)
- `upsert`: Overwrite existing file (default: `false`)
- `metadata`: Custom metadata object
- `acl`: Access control (`public-read`, `private`, `authenticated-read`)

#### `download(bucket, path, options?)`
Download a file from storage.

```typescript
const { data: blob, error } = await storage.download(
  'documents',
  `${userId}/contract.pdf`
)

if (blob) {
  // Convert to download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'contract.pdf'
  link.click()
}
```

**With Transformations (image providers only):**
```typescript
const { data: blob, error } = await storage.download(
  'avatars',
  `${userId}/profile.jpg`,
  {
    transform: {
      width: 200,
      height: 200,
      quality: 80,
      format: 'webp'
    }
  }
)
```

#### `delete(bucket, path)`
Delete a single file.

```typescript
const { data: success, error } = await storage.delete(
  'avatars',
  `${userId}/old-profile.jpg`
)
```

#### `deleteMany(bucket, paths)`
Delete multiple files.

```typescript
const { data: success, error } = await storage.deleteMany(
  'avatars',
  [
    `${userId}/photo1.jpg`,
    `${userId}/photo2.jpg`,
    `${userId}/photo3.jpg`
  ]
)
```

#### `exists(bucket, path)`
Check if a file exists.

```typescript
const { data: exists, error } = await storage.exists(
  'avatars',
  `${userId}/profile.jpg`
)

if (exists) {
  console.log('File exists')
}
```

#### `getMetadata(bucket, path)`
Get file metadata.

```typescript
const { data: file, error } = await storage.getMetadata(
  'avatars',
  `${userId}/profile.jpg`
)

console.log('File:', {
  name: file.name,
  size: file.size,
  contentType: file.contentType,
  lastModified: file.lastModified,
  publicUrl: file.publicUrl
})
```

#### `list(bucket, options?)`
List files in a bucket.

```typescript
const { data: files, error, count } = await storage.list('avatars', {
  prefix: `${userId}/`,
  limit: 10,
  offset: 0,
  search: 'profile'
})

files.forEach(file => {
  console.log(`${file.name} - ${file.size} bytes`)
})
```

#### `move(bucket, fromPath, toPath)`
Move/rename a file.

```typescript
const { data: success, error } = await storage.move(
  'avatars',
  `${userId}/old-name.jpg`,
  `${userId}/new-name.jpg`
)
```

#### `copy(sourceBucket, sourcePath, destBucket, destPath)`
Copy a file.

```typescript
const { data: success, error } = await storage.copy(
  'avatars',
  `${userId}/profile.jpg`,
  'backups',
  `${userId}/profile-backup.jpg`
)
```

---

### URL Operations

#### `getPublicUrl(bucket, path, options?)`
Get public URL for a file (works for public buckets only).

```typescript
const url = storage.getPublicUrl('avatars', `${userId}/profile.jpg`)

// With download filename
const url = storage.getPublicUrl('documents', `${userId}/contract.pdf`, {
  download: 'My Contract.pdf'
})
```

#### `createSignedUrl(bucket, path, options?)`
Create a signed URL for temporary access (works for private files).

```typescript
const { data: signedUrl, error } = await storage.createSignedUrl(
  'private-docs',
  `${userId}/confidential.pdf`,
  { expiresIn: 3600 } // Expires in 1 hour
)

console.log('Temporary URL:', signedUrl)
```

#### `createSignedUrls(bucket, paths, options?)`
Create signed URLs for multiple files.

```typescript
const { data: urls, error } = await storage.createSignedUrls(
  'private-docs',
  [
    `${userId}/doc1.pdf`,
    `${userId}/doc2.pdf`,
    `${userId}/doc3.pdf`
  ],
  { expiresIn: 7200 } // 2 hours
)

urls.forEach(url => console.log('Signed URL:', url))
```

---

### Advanced Operations

#### `uploadWithProgress(bucket, path, file, onProgress, options?)`
Upload file with progress tracking.

```typescript
const { url, error, abort } = await storage.uploadWithProgress(
  'videos',
  `${userId}/video.mp4`,
  videoFile,
  (progress) => {
    console.log(`Upload progress: ${progress}%`)
    updateProgressBar(progress)
  },
  { contentType: 'video/mp4' }
)

// Abort upload if needed
if (userClickedCancel) {
  abort()
}
```

#### `createPresignedPost(bucket, path, options?)` ⚠️
Generate presigned POST data for direct client uploads (S3-specific).

```typescript
// Not supported in Supabase Storage
// Use regular upload() instead

// AWS S3 (future):
const { data: post, error } = await storage.createPresignedPost(
  'uploads',
  `${userId}/file.pdf`,
  { expiresIn: 3600 }
)

// Client can POST directly to S3
fetch(post.url, {
  method: 'POST',
  body: formData
})
```

---

## BUCKET STRUCTURE BEST PRACTICES

### Recommended Bucket Layout

```
avatars/          # User profile pictures (public)
├── {userId}/
│   └── profile.jpg

documents/        # User documents (private)
├── {userId}/
│   ├── contract.pdf
│   └── invoice.pdf

images/           # General images (public)
├── products/
│   └── product-123.jpg
└── banners/
    └── hero.jpg

videos/           # Video content (private)
└── {userId}/
    └── video.mp4

backups/          # Backups (private, admin-only)
└── {date}/
    └── database.sql
```

### Security Best Practices

1. **Use private buckets by default**
   ```typescript
   await storage.createBucket('user-documents', { public: false })
   ```

2. **Use signed URLs for temporary access**
   ```typescript
   const { data: url } = await storage.createSignedUrl(
     'user-documents',
     `${userId}/sensitive.pdf`,
     { expiresIn: 600 } // 10 minutes
   )
   ```

3. **Organize files by user ID**
   ```typescript
   const path = `${userId}/filename.ext` // Good
   const path = `shared/filename.ext`    // Bad (potential leakage)
   ```

4. **Validate file types before upload**
   ```typescript
   const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
   if (!allowedTypes.includes(file.type)) {
     throw new Error('Invalid file type')
   }
   ```

5. **Set content type explicitly**
   ```typescript
   await storage.upload('avatars', path, file, {
     contentType: file.type // Prevents MIME type confusion attacks
   })
   ```

---

## MIGRATION GUIDE

### From Direct Supabase Storage

**Before:**
```typescript
import { supabase } from '@/integrations/supabase/client'

const { data, error } = await supabase.storage
  .from('avatars')
  .upload('profile.jpg', file)

const { data: urlData } = supabase.storage
  .from('avatars')
  .getPublicUrl('profile.jpg')
```

**After:**
```typescript
import { storage } from '@/lib/storage'

const { data: url, error } = await storage.upload(
  'avatars',
  'profile.jpg',
  file
)
```

### Migration Checklist

- [ ] Replace `supabase.storage.from(bucket).upload()` → `storage.upload(bucket, ...)`
- [ ] Replace `supabase.storage.from(bucket).download()` → `storage.download(bucket, ...)`
- [ ] Replace `supabase.storage.from(bucket).remove()` → `storage.delete(bucket, ...)`
- [ ] Replace `supabase.storage.from(bucket).list()` → `storage.list(bucket, ...)`
- [ ] Replace `supabase.storage.from(bucket).getPublicUrl()` → `storage.getPublicUrl(bucket, ...)`
- [ ] Replace `supabase.storage.from(bucket).createSignedUrl()` → `storage.createSignedUrl(bucket, ...)`

---

## SWITCHING PROVIDERS

### Current: Supabase Storage

**Environment Variables:**
```bash
VITE_STORAGE_PROVIDER=supabase
VITE_SUPABASE_URL=https://wwajmaohwcbooljdureo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
```

### Future: AWS S3

**Steps to Switch:**

1. **Install AWS SDK:**
   ```bash
   npm install @aws-sdk/client-s3
   ```

2. **Create S3 provider:**
   ```typescript
   // src/lib/storage/providers/s3.ts
   import { S3Client } from '@aws-sdk/client-s3'

   export class S3Storage implements IStorage {
     // Implement IStorage interface
   }
   ```

3. **Update factory:**
   ```typescript
   // src/lib/storage/index.ts
   case 's3':
     return new S3Storage({
       region: options.region,
       accessKeyId: options.accessKeyId,
       secretAccessKey: options.secretAccessKey
     })
   ```

4. **Update environment variables:**
   ```bash
   VITE_STORAGE_PROVIDER=s3
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=<your-key>
   AWS_SECRET_ACCESS_KEY=<your-secret>
   ```

5. **Deploy and test** - Application code remains unchanged!

---

## TESTING

### Unit Testing with Mocks

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { IStorage } from '@/lib/storage'

const mockStorage: IStorage = {
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  // ... implement all interface methods
}

describe('Avatar Service', () => {
  it('should upload avatar', async () => {
    const mockUrl = 'https://example.com/avatar.jpg'
    mockStorage.upload.mockResolvedValue({ data: mockUrl, error: null })

    const result = await avatarService.uploadAvatar(file)

    expect(mockStorage.upload).toHaveBeenCalledWith(
      'avatars',
      expect.stringContaining('profile.jpg'),
      file
    )
    expect(result).toBe(mockUrl)
  })
})
```

---

## PERFORMANCE OPTIMIZATION

### Use CDN for Public Files

```typescript
// Upload with long cache control
await storage.upload('images', 'logo.png', file, {
  contentType: 'image/png',
  cacheControl: '31536000' // 1 year
})

// Supabase Storage is already CDN-backed (Fastly)
const url = storage.getPublicUrl('images', 'logo.png')
```

### Batch Delete Operations

```typescript
// ❌ BAD: Multiple round trips
for (const path of paths) {
  await storage.delete('avatars', path)
}

// ✅ GOOD: Single batch operation
await storage.deleteMany('avatars', paths)
```

### Optimize Image Uploads

```typescript
// Compress image before upload
const compressed = await compressImage(file, { quality: 0.8 })

await storage.upload('avatars', path, compressed, {
  contentType: 'image/jpeg',
  cacheControl: '86400' // 1 day
})
```

---

## LIMITATIONS

### Current Limitations (Supabase Storage)

1. **Progress Tracking:** Not natively supported (workaround provided)
2. **Presigned POST:** Not supported (S3-specific feature)
3. **Image Transformations:** Limited (width/height only)
4. **File Size Limit:** 50MB default (configurable per bucket)
5. **Copy Operation:** Implemented via download + upload (slower)

### Workarounds

For large file uploads, use chunked uploads:
```typescript
// Split file into chunks and upload separately
// Combine server-side (future enhancement)
```

---

## TROUBLESHOOTING

### Error: "Storage not configured"

**Solution:** Set environment variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### Error: "File size exceeds limit"

**Solution:** Increase bucket size limit in Supabase Dashboard:
```
Storage > Buckets > [Your Bucket] > Settings > File size limit
```

### Slow Uploads

**Solution:**
1. Compress files before upload
2. Use appropriate cache control headers
3. Consider direct client → storage uploads (presigned POST for S3)

---

## FUTURE ENHANCEMENTS

**Phase 2 (Weeks 3-4):**
- [ ] Add AWS S3 provider implementation
- [ ] Add image optimization service
- [ ] Add file virus scanning

**Phase 3 (Weeks 5-6):**
- [ ] Add Cloudflare R2 provider (S3-compatible, no egress fees)
- [ ] Add chunked upload support for large files
- [ ] Add automatic file compression

---

**Document Status:** ✅ COMPLETE
**Last Updated:** 2026-01-03
**Owner:** Backend Team
