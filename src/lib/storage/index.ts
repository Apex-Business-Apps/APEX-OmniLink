/**
 * STORAGE ABSTRACTION LAYER - FACTORY
 *
 * Purpose: Create storage instances with provider abstraction
 * Usage:
 *   import { createStorage, storage } from '@/lib/storage'
 *
 *   // Option 1: Use singleton instance (recommended)
 *   const { data: url } = await storage.upload('avatars', 'profile.jpg', file)
 *
 *   // Option 2: Create custom instance
 *   const s3Storage = createStorage({ provider: 's3', region: 'us-east-1', ... })
 */

import type { IStorage, StorageFactoryOptions } from './interface'
import { SupabaseStorage } from './providers/supabase'

// ============================================================================
// STORAGE FACTORY
// ============================================================================

/**
 * Create a storage instance based on provider
 */
export function createStorage(options: StorageFactoryOptions): IStorage {
  switch (options.provider) {
    case 'supabase':
      if (!options.url || !options.apiKey) {
        throw new Error(
          'Supabase provider requires "url" and "apiKey" options'
        )
      }

      return new SupabaseStorage({
        url: options.url,
        apiKey: options.apiKey,
        serviceRoleKey: options.serviceRoleKey,
        debug: options.debug,
      })

    case 's3':
      // Future implementation
      throw new Error('AWS S3 provider not yet implemented')

    case 'gcs':
      // Future implementation
      throw new Error('Google Cloud Storage provider not yet implemented')

    case 'azure':
      // Future implementation
      throw new Error('Azure Blob Storage provider not yet implemented')

    case 'r2':
      // Future implementation
      throw new Error('Cloudflare R2 provider not yet implemented')

    default:
      throw new Error(`Unknown storage provider: ${options.provider}`)
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Default storage instance (Supabase Storage)
 * Configured from environment variables
 */
let _storage: IStorage | null = null

export function getStorage(): IStorage {
  if (_storage) {
    return _storage
  }

  // Read from environment variables
  const provider = (import.meta.env.VITE_STORAGE_PROVIDER ||
    'supabase') as StorageFactoryOptions['provider']
  const url = import.meta.env.VITE_SUPABASE_URL
  const apiKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  const debug = import.meta.env.DEV

  if (!url || !apiKey) {
    throw new Error(
      'Storage not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.'
    )
  }

  _storage = createStorage({
    provider,
    url,
    apiKey,
    serviceRoleKey,
    debug,
  })

  return _storage
}

/**
 * Singleton storage instance
 * Lazy-loaded on first access
 */
export const storage = new Proxy({} as IStorage, {
  get(target, prop) {
    const instance = getStorage()
    return (instance as any)[prop]
  },
})

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type {
  IStorage,
  UploadOptions,
  DownloadOptions,
  ListOptions,
  StorageFile,
  StorageResult,
  StorageListResult,
  SignedUrlOptions,
  StorageProvider,
  StorageFactoryOptions,
} from './interface'

export { SupabaseStorage } from './providers/supabase'

// ============================================================================
// MIGRATION HELPER
// ============================================================================

/**
 * Helper for migrating from direct Supabase Storage usage to abstraction layer
 *
 * Before:
 *   import { supabase } from '@/integrations/supabase/client'
 *   const { data } = await supabase.storage.from('avatars').upload('profile.jpg', file)
 *
 * After:
 *   import { storage } from '@/lib/storage'
 *   const { data: url } = await storage.upload('avatars', 'profile.jpg', file)
 */
export const migrationGuide = {
  upload: 'storage.upload(bucket, path, file, options)',
  download: 'storage.download(bucket, path)',
  remove: 'storage.delete(bucket, path) or storage.deleteMany(bucket, paths)',
  list: 'storage.list(bucket, { prefix, limit, offset })',
  getPublicUrl: 'storage.getPublicUrl(bucket, path)',
  createSignedUrl: 'storage.createSignedUrl(bucket, path, { expiresIn })',
  move: 'storage.move(bucket, fromPath, toPath)',
  copy: 'storage.copy(sourceBucket, sourcePath, destBucket, destPath)',
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * EXAMPLE USAGE:
 *
 * // Upload file
 * const { data: url, error } = await storage.upload(
 *   'avatars',
 *   `${userId}/profile.jpg`,
 *   fileBlob,
 *   { contentType: 'image/jpeg', upsert: true }
 * )
 *
 * // Download file
 * const { data: blob, error } = await storage.download('avatars', `${userId}/profile.jpg`)
 *
 * // Delete file
 * const { data: success, error } = await storage.delete('avatars', `${userId}/profile.jpg`)
 *
 * // List files
 * const { data: files, error } = await storage.list('avatars', {
 *   prefix: `${userId}/`,
 *   limit: 10
 * })
 *
 * // Get public URL
 * const url = storage.getPublicUrl('avatars', `${userId}/profile.jpg`)
 *
 * // Create signed URL (for private files)
 * const { data: signedUrl, error } = await storage.createSignedUrl(
 *   'private-docs',
 *   `${userId}/document.pdf`,
 *   { expiresIn: 3600 } // 1 hour
 * )
 *
 * // Upload with progress tracking
 * const { url, error, abort } = await storage.uploadWithProgress(
 *   'avatars',
 *   `${userId}/profile.jpg`,
 *   file,
 *   (progress) => console.log(`Upload: ${progress}%`)
 * )
 *
 * // Abort upload
 * abort()
 */
