/**
 * STORAGE ABSTRACTION LAYER - INTERFACE
 *
 * Purpose: S3-compatible storage interface for OmniHub
 * Reduces lock-in risk by abstracting cloud storage APIs
 *
 * Supported providers:
 * - Supabase Storage (current)
 * - AWS S3 (future)
 * - Google Cloud Storage (future)
 * - Azure Blob Storage (future)
 * - Cloudflare R2 (future)
 *
 * Design principles:
 * 1. S3-compatible API (industry standard)
 * 2. Simple interface (upload, download, delete, list)
 * 3. Type-safe operations
 * 4. Easy to test (mockable)
 */

// ============================================================================
// STORAGE TYPES
// ============================================================================

export interface UploadOptions {
  /** Content type (MIME type) */
  contentType?: string

  /** Cache control header (e.g., "3600" for 1 hour) */
  cacheControl?: string

  /** Whether to overwrite existing file */
  upsert?: boolean

  /** Custom metadata */
  metadata?: Record<string, string>

  /** ACL (Access Control List) - "public-read", "private", etc. */
  acl?: 'public-read' | 'private' | 'authenticated-read'
}

export interface DownloadOptions {
  /** Download file as specific filename (Content-Disposition) */
  download?: string

  /** Transformation options (for image providers that support it) */
  transform?: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'png' | 'jpeg'
  }
}

export interface ListOptions {
  /** Prefix to filter files (e.g., "avatars/") */
  prefix?: string

  /** Maximum number of files to return */
  limit?: number

  /** Offset for pagination */
  offset?: number

  /** Search query (if provider supports it) */
  search?: string
}

export interface StorageFile {
  /** File name */
  name: string

  /** Full path to file */
  path: string

  /** File size in bytes */
  size: number

  /** Content type (MIME type) */
  contentType?: string

  /** Last modified timestamp */
  lastModified?: Date

  /** Custom metadata */
  metadata?: Record<string, string>

  /** Public URL (if file is public) */
  publicUrl?: string
}

export interface StorageResult<T> {
  data: T | null
  error: Error | null
}

export interface StorageListResult {
  data: StorageFile[] | null
  error: Error | null
  /** Total count (for pagination) */
  count?: number | null
}

export interface SignedUrlOptions {
  /** Expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number
}

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

/**
 * Generic storage interface (S3-compatible)
 * All storage providers must implement this interface
 */
export interface IStorage {
  // -------------------------------------------------------------------------
  // BUCKET OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Create a new bucket
   */
  createBucket(name: string, options?: { public?: boolean }): Promise<StorageResult<boolean>>

  /**
   * Delete a bucket (must be empty)
   */
  deleteBucket(name: string): Promise<StorageResult<boolean>>

  /**
   * List all buckets
   */
  listBuckets(): Promise<StorageResult<string[]>>

  // -------------------------------------------------------------------------
  // FILE OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Upload a file to storage
   * Returns public URL or signed URL
   */
  upload(
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: UploadOptions
  ): Promise<StorageResult<string>>

  /**
   * Download a file from storage
   * Returns file blob
   */
  download(
    bucket: string,
    path: string,
    options?: DownloadOptions
  ): Promise<StorageResult<Blob>>

  /**
   * Delete a file from storage
   */
  delete(bucket: string, path: string): Promise<StorageResult<boolean>>

  /**
   * Delete multiple files from storage
   */
  deleteMany(bucket: string, paths: string[]): Promise<StorageResult<boolean>>

  /**
   * Check if a file exists
   */
  exists(bucket: string, path: string): Promise<StorageResult<boolean>>

  /**
   * Get file metadata
   */
  getMetadata(bucket: string, path: string): Promise<StorageResult<StorageFile>>

  /**
   * List files in a bucket
   */
  list(bucket: string, options?: ListOptions): Promise<StorageListResult>

  /**
   * Move/rename a file
   */
  move(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<StorageResult<boolean>>

  /**
   * Copy a file
   */
  copy(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string
  ): Promise<StorageResult<boolean>>

  // -------------------------------------------------------------------------
  // URL OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Get public URL for a file
   * Returns URL immediately (works for public files only)
   */
  getPublicUrl(bucket: string, path: string, options?: { download?: string }): string

  /**
   * Create a signed URL for temporary access
   * Returns time-limited URL that works for private files
   */
  createSignedUrl(
    bucket: string,
    path: string,
    options?: SignedUrlOptions
  ): Promise<StorageResult<string>>

  /**
   * Create signed URLs for multiple files
   */
  createSignedUrls(
    bucket: string,
    paths: string[],
    options?: SignedUrlOptions
  ): Promise<StorageResult<string[]>>

  // -------------------------------------------------------------------------
  // ADVANCED OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Upload file with progress tracking
   * Returns progress callback and abort function
   */
  uploadWithProgress(
    bucket: string,
    path: string,
    file: File | Blob,
    onProgress: (progress: number) => void,
    options?: UploadOptions
  ): Promise<{
    url: string | null
    error: Error | null
    abort: () => void
  }>

  /**
   * Generate presigned POST data for client-side uploads
   * Useful for direct browser → storage uploads (bypassing server)
   */
  createPresignedPost(
    bucket: string,
    path: string,
    options?: UploadOptions & { expiresIn?: number }
  ): Promise<
    StorageResult<{
      url: string
      fields: Record<string, string>
    }>
  >

  // -------------------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------------------

  /**
   * Check if storage connection is healthy
   */
  ping(): Promise<boolean>
}

// ============================================================================
// STORAGE PROVIDER TYPE
// ============================================================================

export type StorageProvider =
  | 'supabase'
  | 's3'
  | 'gcs'
  | 'azure'
  | 'r2'

// ============================================================================
// STORAGE FACTORY OPTIONS
// ============================================================================

export interface StorageFactoryOptions {
  provider: StorageProvider

  // Supabase-specific
  url?: string
  apiKey?: string
  serviceRoleKey?: string

  // AWS S3-specific
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  endpoint?: string // For S3-compatible services (R2, MinIO)

  // GCS-specific
  projectId?: string
  keyFilename?: string
  credentials?: object

  // Azure-specific
  accountName?: string
  accountKey?: string
  sasToken?: string

  // Optional: Enable debug logging
  debug?: boolean
}
