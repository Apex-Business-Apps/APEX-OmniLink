/**
 * STORAGE ABSTRACTION LAYER - UNIT TESTS
 *
 * Tests for S3-compatible storage interface and Supabase Storage provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IStorage, StorageFile, UploadOptions } from '@/lib/storage/interface'

// ============================================================================
// MOCK STORAGE IMPLEMENTATION
// ============================================================================

class MockStorage implements IStorage {
  private mockFiles: Record<string, Record<string, StorageFile>> = {
    avatars: {
      'user1/profile.jpg': {
        name: 'profile.jpg',
        path: 'user1/profile.jpg',
        size: 1024,
        contentType: 'image/jpeg',
        lastModified: new Date('2025-01-01'),
        publicUrl: 'https://example.com/user1/profile.jpg',
      },
    },
  }

  private mockBuckets: string[] = ['avatars', 'documents', 'images']

  async createBucket(name: string): Promise<{ data: boolean | null; error: Error | null }> {
    if (this.mockBuckets.includes(name)) {
      return { data: null, error: new Error('Bucket already exists') }
    }
    this.mockBuckets.push(name)
    this.mockFiles[name] = {}
    return { data: true, error: null }
  }

  async deleteBucket(name: string): Promise<{ data: boolean | null; error: Error | null }> {
    if (!this.mockBuckets.includes(name)) {
      return { data: null, error: new Error('Bucket not found') }
    }
    if (Object.keys(this.mockFiles[name] || {}).length > 0) {
      return { data: null, error: new Error('Bucket not empty') }
    }
    this.mockBuckets = this.mockBuckets.filter((b) => b !== name)
    delete this.mockFiles[name]
    return { data: true, error: null }
  }

  async listBuckets(): Promise<{ data: string[] | null; error: Error | null }> {
    return { data: this.mockBuckets, error: null }
  }

  async upload(
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: UploadOptions
  ): Promise<{ data: string | null; error: Error | null }> {
    if (!this.mockBuckets.includes(bucket)) {
      return { data: null, error: new Error('Bucket not found') }
    }

    if (!this.mockFiles[bucket]) {
      this.mockFiles[bucket] = {}
    }

    const size = file instanceof ArrayBuffer ? file.byteLength : file.size
    const contentType = options?.contentType || 'application/octet-stream'

    this.mockFiles[bucket][path] = {
      name: path.split('/').pop() || path,
      path,
      size,
      contentType,
      lastModified: new Date(),
      publicUrl: `https://example.com/${bucket}/${path}`,
    }

    return { data: `https://example.com/${bucket}/${path}`, error: null }
  }

  async download(
    bucket: string,
    path: string
  ): Promise<{ data: Blob | null; error: Error | null }> {
    const file = this.mockFiles[bucket]?.[path]
    if (!file) {
      return { data: null, error: new Error('File not found') }
    }
    return { data: new Blob(['mock-file-content']), error: null }
  }

  async delete(bucket: string, path: string): Promise<{ data: boolean | null; error: Error | null }> {
    if (!this.mockFiles[bucket]?.[path]) {
      return { data: null, error: new Error('File not found') }
    }
    delete this.mockFiles[bucket][path]
    return { data: true, error: null }
  }

  async deleteMany(bucket: string, paths: string[]): Promise<{ data: boolean | null; error: Error | null }> {
    for (const path of paths) {
      if (this.mockFiles[bucket]?.[path]) {
        delete this.mockFiles[bucket][path]
      }
    }
    return { data: true, error: null }
  }

  async exists(bucket: string, path: string): Promise<{ data: boolean | null; error: Error | null }> {
    const exists = !!this.mockFiles[bucket]?.[path]
    return { data: exists, error: null }
  }

  async getMetadata(
    bucket: string,
    path: string
  ): Promise<{ data: StorageFile | null; error: Error | null }> {
    const file = this.mockFiles[bucket]?.[path]
    if (!file) {
      return { data: null, error: new Error('File not found') }
    }
    return { data: file, error: null }
  }

  async list(
    bucket: string,
    options?: any
  ): Promise<{ data: StorageFile[] | null; error: Error | null; count?: number | null }> {
    if (!this.mockFiles[bucket]) {
      return { data: [], error: null, count: 0 }
    }

    let files = Object.values(this.mockFiles[bucket])

    // Apply prefix filter
    if (options?.prefix) {
      files = files.filter((f) => f.path.startsWith(options.prefix))
    }

    // Apply search filter
    if (options?.search) {
      files = files.filter((f) => f.name.includes(options.search))
    }

    // Apply limit/offset
    if (options?.offset) {
      files = files.slice(options.offset)
    }
    if (options?.limit) {
      files = files.slice(0, options.limit)
    }

    return { data: files, error: null, count: files.length }
  }

  async move(
    bucket: string,
    fromPath: string,
    toPath: string
  ): Promise<{ data: boolean | null; error: Error | null }> {
    const file = this.mockFiles[bucket]?.[fromPath]
    if (!file) {
      return { data: null, error: new Error('Source file not found') }
    }

    this.mockFiles[bucket][toPath] = {
      ...file,
      name: toPath.split('/').pop() || toPath,
      path: toPath,
      publicUrl: `https://example.com/${bucket}/${toPath}`,
    }
    delete this.mockFiles[bucket][fromPath]

    return { data: true, error: null }
  }

  async copy(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string
  ): Promise<{ data: boolean | null; error: Error | null }> {
    const file = this.mockFiles[sourceBucket]?.[sourcePath]
    if (!file) {
      return { data: null, error: new Error('Source file not found') }
    }

    if (!this.mockFiles[destBucket]) {
      this.mockFiles[destBucket] = {}
    }

    this.mockFiles[destBucket][destPath] = {
      ...file,
      name: destPath.split('/').pop() || destPath,
      path: destPath,
      publicUrl: `https://example.com/${destBucket}/${destPath}`,
    }

    return { data: true, error: null }
  }

  getPublicUrl(bucket: string, path: string): string {
    return `https://example.com/${bucket}/${path}`
  }

  async createSignedUrl(
    bucket: string,
    path: string,
    options?: any
  ): Promise<{ data: string | null; error: Error | null }> {
    const file = this.mockFiles[bucket]?.[path]
    if (!file) {
      return { data: null, error: new Error('File not found') }
    }
    const expiresIn = options?.expiresIn || 3600
    return {
      data: `https://example.com/${bucket}/${path}?signed=true&expires=${Date.now() + expiresIn * 1000}`,
      error: null,
    }
  }

  async createSignedUrls(
    bucket: string,
    paths: string[],
    options?: any
  ): Promise<{ data: string[] | null; error: Error | null }> {
    const urls: string[] = []
    for (const path of paths) {
      const { data: url } = await this.createSignedUrl(bucket, path, options)
      if (url) urls.push(url)
    }
    return { data: urls, error: null }
  }

  async uploadWithProgress(
    bucket: string,
    path: string,
    file: File | Blob,
    onProgress: (progress: number) => void,
    options?: UploadOptions
  ): Promise<{ url: string | null; error: Error | null; abort: () => void }> {
    let aborted = false
    const abort = () => {
      aborted = true
    }

    // Simulate progress
    onProgress(0)
    await new Promise((resolve) => setTimeout(resolve, 10))
    if (aborted) return { url: null, error: new Error('Upload aborted'), abort }

    onProgress(50)
    await new Promise((resolve) => setTimeout(resolve, 10))
    if (aborted) return { url: null, error: new Error('Upload aborted'), abort }

    const { data: url, error } = await this.upload(bucket, path, file, options)
    onProgress(100)

    return { url, error, abort }
  }

  async createPresignedPost(): Promise<{
    data: { url: string; fields: Record<string, string> } | null
    error: Error | null
  }> {
    return {
      data: null,
      error: new Error('Not supported in mock storage'),
    }
  }

  async ping(): Promise<boolean> {
    return true
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Storage Abstraction Layer', () => {
  let storage: IStorage

  beforeEach(() => {
    storage = new MockStorage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // BUCKET OPERATIONS
  // -------------------------------------------------------------------------

  describe('createBucket', () => {
    it('should create a new bucket', async () => {
      const { data: success, error } = await storage.createBucket('new-bucket')

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify bucket was created
      const { data: buckets } = await storage.listBuckets()
      expect(buckets).toContain('new-bucket')
    })

    it('should return error for duplicate bucket', async () => {
      const { data: success, error } = await storage.createBucket('avatars')

      expect(error).not.toBeNull()
      expect(error?.message).toContain('already exists')
      expect(success).toBeNull()
    })
  })

  describe('deleteBucket', () => {
    it('should delete an empty bucket', async () => {
      await storage.createBucket('temp-bucket')
      const { data: success, error } = await storage.deleteBucket('temp-bucket')

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify bucket was deleted
      const { data: buckets } = await storage.listBuckets()
      expect(buckets).not.toContain('temp-bucket')
    })

    it('should return error for non-empty bucket', async () => {
      const { data: success, error } = await storage.deleteBucket('avatars')

      expect(error).not.toBeNull()
      expect(error?.message).toContain('not empty')
      expect(success).toBeNull()
    })

    it('should return error for non-existent bucket', async () => {
      const { data: success, error } = await storage.deleteBucket('nonexistent')

      expect(error).not.toBeNull()
      expect(error?.message).toContain('not found')
      expect(success).toBeNull()
    })
  })

  describe('listBuckets', () => {
    it('should list all buckets', async () => {
      const { data: buckets, error } = await storage.listBuckets()

      expect(error).toBeNull()
      expect(buckets).toEqual(['avatars', 'documents', 'images'])
    })
  })

  // -------------------------------------------------------------------------
  // FILE OPERATIONS
  // -------------------------------------------------------------------------

  describe('upload', () => {
    it('should upload a file', async () => {
      const file = new Blob(['test content'], { type: 'text/plain' })
      const { data: url, error } = await storage.upload('documents', 'test.txt', file, {
        contentType: 'text/plain',
      })

      expect(error).toBeNull()
      expect(url).toContain('documents/test.txt')

      // Verify file was uploaded
      const { data: exists } = await storage.exists('documents', 'test.txt')
      expect(exists).toBe(true)
    })

    it('should return error for non-existent bucket', async () => {
      const file = new Blob(['test'])
      const { data: url, error } = await storage.upload('nonexistent', 'test.txt', file)

      expect(error).not.toBeNull()
      expect(error?.message).toContain('not found')
      expect(url).toBeNull()
    })
  })

  describe('download', () => {
    it('should download a file', async () => {
      const { data: blob, error } = await storage.download('avatars', 'user1/profile.jpg')

      expect(error).toBeNull()
      expect(blob).toBeInstanceOf(Blob)
    })

    it('should return error for non-existent file', async () => {
      const { data: blob, error } = await storage.download('avatars', 'nonexistent.jpg')

      expect(error).not.toBeNull()
      expect(error?.message).toContain('not found')
      expect(blob).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete a file', async () => {
      const { data: success, error } = await storage.delete('avatars', 'user1/profile.jpg')

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify file was deleted
      const { data: exists } = await storage.exists('avatars', 'user1/profile.jpg')
      expect(exists).toBe(false)
    })

    it('should return error for non-existent file', async () => {
      const { data: success, error } = await storage.delete('avatars', 'nonexistent.jpg')

      expect(error).not.toBeNull()
      expect(success).toBeNull()
    })
  })

  describe('deleteMany', () => {
    it('should delete multiple files', async () => {
      // Upload test files
      await storage.upload('documents', 'file1.txt', new Blob(['1']))
      await storage.upload('documents', 'file2.txt', new Blob(['2']))
      await storage.upload('documents', 'file3.txt', new Blob(['3']))

      const { data: success, error } = await storage.deleteMany('documents', [
        'file1.txt',
        'file2.txt',
        'file3.txt',
      ])

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify files were deleted
      const { data: exists1 } = await storage.exists('documents', 'file1.txt')
      const { data: exists2 } = await storage.exists('documents', 'file2.txt')
      const { data: exists3 } = await storage.exists('documents', 'file3.txt')

      expect(exists1).toBe(false)
      expect(exists2).toBe(false)
      expect(exists3).toBe(false)
    })
  })

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const { data: exists, error } = await storage.exists('avatars', 'user1/profile.jpg')

      expect(error).toBeNull()
      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const { data: exists, error } = await storage.exists('avatars', 'nonexistent.jpg')

      expect(error).toBeNull()
      expect(exists).toBe(false)
    })
  })

  describe('getMetadata', () => {
    it('should get file metadata', async () => {
      const { data: file, error } = await storage.getMetadata('avatars', 'user1/profile.jpg')

      expect(error).toBeNull()
      expect(file).toEqual({
        name: 'profile.jpg',
        path: 'user1/profile.jpg',
        size: 1024,
        contentType: 'image/jpeg',
        lastModified: expect.any(Date),
        publicUrl: 'https://example.com/user1/profile.jpg',
      })
    })

    it('should return error for non-existent file', async () => {
      const { data: file, error } = await storage.getMetadata('avatars', 'nonexistent.jpg')

      expect(error).not.toBeNull()
      expect(file).toBeNull()
    })
  })

  describe('list', () => {
    it('should list all files in bucket', async () => {
      await storage.upload('images', 'photo1.jpg', new Blob(['1']))
      await storage.upload('images', 'photo2.jpg', new Blob(['2']))

      const { data: files, error, count } = await storage.list('images')

      expect(error).toBeNull()
      expect(files).toHaveLength(2)
      expect(count).toBe(2)
    })

    it('should list files with prefix filter', async () => {
      await storage.upload('images', 'user1/photo1.jpg', new Blob(['1']))
      await storage.upload('images', 'user1/photo2.jpg', new Blob(['2']))
      await storage.upload('images', 'user2/photo1.jpg', new Blob(['3']))

      const { data: files, error } = await storage.list('images', {
        prefix: 'user1/',
      })

      expect(error).toBeNull()
      expect(files).toHaveLength(2)
      expect(files?.every((f) => f.path.startsWith('user1/'))).toBe(true)
    })

    it('should list files with limit', async () => {
      await storage.upload('images', 'photo1.jpg', new Blob(['1']))
      await storage.upload('images', 'photo2.jpg', new Blob(['2']))
      await storage.upload('images', 'photo3.jpg', new Blob(['3']))

      const { data: files, error } = await storage.list('images', { limit: 2 })

      expect(error).toBeNull()
      expect(files).toHaveLength(2)
    })

    it('should list files with offset', async () => {
      await storage.upload('images', 'photo1.jpg', new Blob(['1']))
      await storage.upload('images', 'photo2.jpg', new Blob(['2']))
      await storage.upload('images', 'photo3.jpg', new Blob(['3']))

      const { data: files, error } = await storage.list('images', { offset: 1, limit: 2 })

      expect(error).toBeNull()
      expect(files).toHaveLength(2)
    })
  })

  describe('move', () => {
    it('should move a file', async () => {
      await storage.upload('documents', 'old-name.txt', new Blob(['test']))

      const { data: success, error } = await storage.move(
        'documents',
        'old-name.txt',
        'new-name.txt'
      )

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify old file doesn't exist
      const { data: oldExists } = await storage.exists('documents', 'old-name.txt')
      expect(oldExists).toBe(false)

      // Verify new file exists
      const { data: newExists } = await storage.exists('documents', 'new-name.txt')
      expect(newExists).toBe(true)
    })

    it('should return error for non-existent source file', async () => {
      const { data: success, error } = await storage.move(
        'documents',
        'nonexistent.txt',
        'new-name.txt'
      )

      expect(error).not.toBeNull()
      expect(error?.message).toContain('not found')
      expect(success).toBeNull()
    })
  })

  describe('copy', () => {
    it('should copy a file within same bucket', async () => {
      await storage.upload('documents', 'original.txt', new Blob(['test']))

      const { data: success, error } = await storage.copy(
        'documents',
        'original.txt',
        'documents',
        'copy.txt'
      )

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify both files exist
      const { data: originalExists } = await storage.exists('documents', 'original.txt')
      const { data: copyExists } = await storage.exists('documents', 'copy.txt')

      expect(originalExists).toBe(true)
      expect(copyExists).toBe(true)
    })

    it('should copy a file to different bucket', async () => {
      await storage.upload('documents', 'file.txt', new Blob(['test']))

      const { data: success, error } = await storage.copy(
        'documents',
        'file.txt',
        'images',
        'backup.txt'
      )

      expect(error).toBeNull()
      expect(success).toBe(true)

      const { data: exists } = await storage.exists('images', 'backup.txt')
      expect(exists).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // URL OPERATIONS
  // -------------------------------------------------------------------------

  describe('getPublicUrl', () => {
    it('should get public URL for file', () => {
      const url = storage.getPublicUrl('avatars', 'user1/profile.jpg')

      expect(url).toBe('https://example.com/avatars/user1/profile.jpg')
    })
  })

  describe('createSignedUrl', () => {
    it('should create a signed URL', async () => {
      const { data: url, error } = await storage.createSignedUrl(
        'avatars',
        'user1/profile.jpg',
        { expiresIn: 3600 }
      )

      expect(error).toBeNull()
      expect(url).toContain('signed=true')
      expect(url).toContain('expires=')
    })

    it('should return error for non-existent file', async () => {
      const { data: url, error } = await storage.createSignedUrl(
        'avatars',
        'nonexistent.jpg'
      )

      expect(error).not.toBeNull()
      expect(url).toBeNull()
    })
  })

  describe('createSignedUrls', () => {
    it('should create signed URLs for multiple files', async () => {
      await storage.upload('documents', 'doc1.pdf', new Blob(['1']))
      await storage.upload('documents', 'doc2.pdf', new Blob(['2']))

      const { data: urls, error } = await storage.createSignedUrls(
        'documents',
        ['doc1.pdf', 'doc2.pdf'],
        { expiresIn: 3600 }
      )

      expect(error).toBeNull()
      expect(urls).toHaveLength(2)
      expect(urls?.every((url) => url.includes('signed=true'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // ADVANCED OPERATIONS
  // -------------------------------------------------------------------------

  describe('uploadWithProgress', () => {
    it('should upload file with progress tracking', async () => {
      const progressValues: number[] = []
      const file = new Blob(['test content'])

      const { url, error, abort } = await storage.uploadWithProgress(
        'documents',
        'test.txt',
        file,
        (progress) => {
          progressValues.push(progress)
        }
      )

      expect(error).toBeNull()
      expect(url).toContain('documents/test.txt')
      expect(progressValues).toContain(0)
      expect(progressValues).toContain(100)
      expect(typeof abort).toBe('function')
    })
  })

  // -------------------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------------------

  describe('ping', () => {
    it('should return true for healthy connection', async () => {
      const isHealthy = await storage.ping()

      expect(isHealthy).toBe(true)
    })
  })
})
