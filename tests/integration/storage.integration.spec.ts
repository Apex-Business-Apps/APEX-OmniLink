/**
 * STORAGE ABSTRACTION LAYER - INTEGRATION TESTS
 *
 * Tests against real Supabase Storage instance
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createStorage } from '@/lib/storage'
import type { IStorage } from '@/lib/storage'

// ============================================================================
// SETUP
// ============================================================================

let storage: IStorage
const testBucket = 'test-integration'
const testFiles: string[] = []

beforeAll(async () => {
  // Use test Supabase instance
  const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Test Supabase credentials not configured')
  }

  storage = createStorage({
    provider: 'supabase',
    url: supabaseUrl,
    apiKey: supabaseKey,
    serviceRoleKey: supabaseKey,
    debug: true,
  })

  // Verify connection
  const isHealthy = await storage.ping()
  if (!isHealthy) {
    throw new Error('Storage connection failed')
  }

  // Create test bucket
  const { error } = await storage.createBucket(testBucket, { public: true })
  if (error && !error.message.includes('already exists')) {
    console.warn('Could not create test bucket:', error.message)
  }

  console.log('✅ Connected to test storage')
})

afterAll(async () => {
  // Cleanup: Delete all test files
  if (testFiles.length > 0) {
    await storage.deleteMany(testBucket, testFiles)
  }

  console.log('🧹 Cleaned up test files')
})

// Helper: Register file for cleanup
function registerTestFile(path: string) {
  testFiles.push(path)
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Storage Integration Tests', () => {
  // -------------------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------------------

  describe('Health Check', () => {
    it('should ping storage successfully', async () => {
      const isHealthy = await storage.ping()
      expect(isHealthy).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // BUCKET OPERATIONS
  // -------------------------------------------------------------------------

  describe('Bucket Operations', () => {
    it('should list buckets', async () => {
      const { data: buckets, error } = await storage.listBuckets()

      expect(error).toBeNull()
      expect(buckets).toBeInstanceOf(Array)
      expect(buckets).toContain(testBucket)
    })

    it('should create a new bucket', async () => {
      const bucketName = `test-create-${Date.now()}`

      const { data: success, error } = await storage.createBucket(bucketName, {
        public: false,
      })

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify bucket exists
      const { data: buckets } = await storage.listBuckets()
      expect(buckets).toContain(bucketName)

      // Cleanup
      await storage.deleteBucket(bucketName)
    })

    it('should delete empty bucket', async () => {
      const bucketName = `test-delete-${Date.now()}`

      // Create bucket
      await storage.createBucket(bucketName)

      // Delete bucket
      const { data: success, error } = await storage.deleteBucket(bucketName)

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify bucket is gone
      const { data: buckets } = await storage.listBuckets()
      expect(buckets).not.toContain(bucketName)
    })
  })

  // -------------------------------------------------------------------------
  // FILE OPERATIONS
  // -------------------------------------------------------------------------

  describe('File Upload & Download', () => {
    const testPath = `integration-test-${Date.now()}.txt`

    it('should upload a file', async () => {
      const content = 'Hello from integration test!'
      const blob = new Blob([content], { type: 'text/plain' })

      const { data: url, error } = await storage.upload(
        testBucket,
        testPath,
        blob,
        {
          contentType: 'text/plain',
          cacheControl: '3600',
        }
      )

      expect(error).toBeNull()
      expect(url).toContain(testBucket)
      expect(url).toContain(testPath)

      registerTestFile(testPath)
    })

    it('should check if file exists', async () => {
      const { data: exists, error } = await storage.exists(testBucket, testPath)

      expect(error).toBeNull()
      expect(exists).toBe(true)
    })

    it('should get file metadata', async () => {
      const { data: file, error } = await storage.getMetadata(testBucket, testPath)

      expect(error).toBeNull()
      expect(file).not.toBeNull()
      expect(file).toHaveProperty('name')
      expect(file).toHaveProperty('size')
      expect(file).toHaveProperty('contentType', 'text/plain')
    })

    it('should download a file', async () => {
      const { data: blob, error } = await storage.download(testBucket, testPath)

      expect(error).toBeNull()
      expect(blob).toBeInstanceOf(Blob)

      const text = await blob?.text()
      expect(text).toContain('Hello from integration test!')
    })

    it('should get public URL', () => {
      const url = storage.getPublicUrl(testBucket, testPath)

      expect(url).toContain(testBucket)
      expect(url).toContain(testPath)
      expect(url).toMatch(/^https?:\/\//)
    })

    it('should create signed URL', async () => {
      const { data: signedUrl, error } = await storage.createSignedUrl(
        testBucket,
        testPath,
        { expiresIn: 3600 }
      )

      expect(error).toBeNull()
      expect(signedUrl).toMatch(/^https?:\/\//)

      // Signed URL should be accessible
      const response = await fetch(signedUrl!)
      expect(response.ok).toBe(true)

      const text = await response.text()
      expect(text).toContain('Hello from integration test!')
    })

    it('should delete a file', async () => {
      const { data: success, error } = await storage.delete(testBucket, testPath)

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify file is gone
      const { data: exists } = await storage.exists(testBucket, testPath)
      expect(exists).toBe(false)

      // Remove from cleanup list
      const index = testFiles.indexOf(testPath)
      if (index > -1) testFiles.splice(index, 1)
    })
  })

  // -------------------------------------------------------------------------
  // BATCH OPERATIONS
  // -------------------------------------------------------------------------

  describe('Batch Operations', () => {
    it('should delete multiple files', async () => {
      // Upload 3 test files
      const paths = [
        `batch-test-1-${Date.now()}.txt`,
        `batch-test-2-${Date.now()}.txt`,
        `batch-test-3-${Date.now()}.txt`,
      ]

      for (const path of paths) {
        await storage.upload(
          testBucket,
          path,
          new Blob(['test'], { type: 'text/plain' })
        )
        registerTestFile(path)
      }

      // Delete all 3 files
      const { data: success, error } = await storage.deleteMany(testBucket, paths)

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify all files are gone
      for (const path of paths) {
        const { data: exists } = await storage.exists(testBucket, path)
        expect(exists).toBe(false)

        // Remove from cleanup list
        const index = testFiles.indexOf(path)
        if (index > -1) testFiles.splice(index, 1)
      }
    })

    it('should create signed URLs for multiple files', async () => {
      // Upload 2 test files
      const paths = [
        `batch-signed-1-${Date.now()}.txt`,
        `batch-signed-2-${Date.now()}.txt`,
      ]

      for (const path of paths) {
        await storage.upload(
          testBucket,
          path,
          new Blob(['test'], { type: 'text/plain' })
        )
        registerTestFile(path)
      }

      // Create signed URLs
      const { data: urls, error } = await storage.createSignedUrls(
        testBucket,
        paths,
        { expiresIn: 3600 }
      )

      expect(error).toBeNull()
      expect(urls).toHaveLength(2)
      expect(urls?.every(url => url.match(/^https?:\/\//))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // FILE LISTING
  // -------------------------------------------------------------------------

  describe('File Listing', () => {
    beforeAll(async () => {
      // Create test files with prefix
      const prefix = `list-test-${Date.now()}`
      for (let i = 0; i < 5; i++) {
        const path = `${prefix}/file-${i}.txt`
        await storage.upload(
          testBucket,
          path,
          new Blob([`Content ${i}`], { type: 'text/plain' })
        )
        registerTestFile(path)
      }
    })

    it('should list all files in bucket', async () => {
      const { data: files, error, count } = await storage.list(testBucket)

      expect(error).toBeNull()
      expect(files).toBeInstanceOf(Array)
      expect(count).toBeGreaterThan(0)
    })

    it('should list files with prefix filter', async () => {
      const prefix = `list-test-${Date.now()}`

      const { data: files, error } = await storage.list(testBucket, {
        prefix,
      })

      expect(error).toBeNull()
      expect(files).toBeInstanceOf(Array)
      // All files should have the prefix
      expect(files?.every(f => f.path.startsWith(prefix))).toBe(true)
    })

    it('should list files with limit', async () => {
      const { data: files, error } = await storage.list(testBucket, {
        limit: 3,
      })

      expect(error).toBeNull()
      expect(files).toHaveLength(3)
    })

    it('should list files with pagination', async () => {
      const { data: page1 } = await storage.list(testBucket, {
        limit: 2,
        offset: 0,
      })

      const { data: page2 } = await storage.list(testBucket, {
        limit: 2,
        offset: 2,
      })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)

      // Pages should have different files
      const page1Paths = page1?.map(f => f.path) || []
      const page2Paths = page2?.map(f => f.path) || []

      expect(page1Paths).not.toEqual(page2Paths)
    })
  })

  // -------------------------------------------------------------------------
  // FILE OPERATIONS (MOVE & COPY)
  // -------------------------------------------------------------------------

  describe('Move & Copy Operations', () => {
    it('should move a file', async () => {
      const sourcePath = `move-source-${Date.now()}.txt`
      const destPath = `move-dest-${Date.now()}.txt`

      // Upload source file
      await storage.upload(
        testBucket,
        sourcePath,
        new Blob(['move test'], { type: 'text/plain' })
      )
      registerTestFile(sourcePath)
      registerTestFile(destPath)

      // Move file
      const { data: success, error } = await storage.move(
        testBucket,
        sourcePath,
        destPath
      )

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify source file is gone
      const { data: sourceExists } = await storage.exists(testBucket, sourcePath)
      expect(sourceExists).toBe(false)

      // Verify dest file exists
      const { data: destExists } = await storage.exists(testBucket, destPath)
      expect(destExists).toBe(true)
    })

    it('should copy a file', async () => {
      const sourcePath = `copy-source-${Date.now()}.txt`
      const destPath = `copy-dest-${Date.now()}.txt`

      // Upload source file
      await storage.upload(
        testBucket,
        sourcePath,
        new Blob(['copy test'], { type: 'text/plain' })
      )
      registerTestFile(sourcePath)
      registerTestFile(destPath)

      // Copy file
      const { data: success, error } = await storage.copy(
        testBucket,
        sourcePath,
        testBucket,
        destPath
      )

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify both files exist
      const { data: sourceExists } = await storage.exists(testBucket, sourcePath)
      const { data: destExists } = await storage.exists(testBucket, destPath)

      expect(sourceExists).toBe(true)
      expect(destExists).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // UPLOAD WITH PROGRESS
  // -------------------------------------------------------------------------

  describe('Upload with Progress', () => {
    it('should upload file with progress tracking', async () => {
      const path = `progress-test-${Date.now()}.txt`
      const content = 'Progress tracking test'
      const blob = new Blob([content], { type: 'text/plain' })

      const progressValues: number[] = []

      const { url, error, abort } = await storage.uploadWithProgress(
        testBucket,
        path,
        blob,
        (progress) => {
          progressValues.push(progress)
        }
      )

      expect(error).toBeNull()
      expect(url).toContain(path)
      expect(progressValues).toContain(0)
      expect(progressValues).toContain(100)
      expect(typeof abort).toBe('function')

      registerTestFile(path)
    })
  })

  // -------------------------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should handle non-existent file gracefully', async () => {
      const { data: blob, error } = await storage.download(
        testBucket,
        'non-existent-file.txt'
      )

      expect(error).not.toBeNull()
      expect(blob).toBeNull()
    })

    it('should handle non-existent bucket gracefully', async () => {
      const { data: files, error } = await storage.list('non-existent-bucket')

      // Behavior may vary - either error or empty array
      if (error) {
        expect(error.message).toContain('not found')
      } else {
        expect(files).toEqual([])
      }
    })

    it('should handle invalid file upload', async () => {
      // Try to upload to non-existent bucket
      const { data: url, error } = await storage.upload(
        'non-existent-bucket',
        'test.txt',
        new Blob(['test'])
      )

      expect(error).not.toBeNull()
      expect(url).toBeNull()
    })
  })
})
