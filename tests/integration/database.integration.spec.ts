/**
 * DATABASE ABSTRACTION LAYER - INTEGRATION TESTS
 *
 * Tests against real Supabase instance (or test database)
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createDatabase } from '@/lib/database'
import type { IDatabase } from '@/lib/database'

// ============================================================================
// SETUP
// ============================================================================

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.SUPABASE_ANON_KEY
  ?? ''
const requireIntegration = (process.env.REQUIRE_SUPABASE_INTEGRATION_TESTS ?? '')
  .toLowerCase() === 'true'
const hasCreds = Boolean(supabaseUrl && supabaseKey)
const suite = hasCreds ? describe : describe.skip

let db: IDatabase
let testUserId: string

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

suite('Database Integration Tests', () => {
  if (!hasCreds && requireIntegration) {
    it('requires Supabase test credentials', () => {
      throw new Error(
        'Test Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).'
      )
    })
    return
  }

  beforeAll(async () => {
    db = createDatabase({
      provider: 'supabase',
      url: supabaseUrl,
      apiKey: supabaseKey,
      serviceRoleKey: supabaseKey,
      debug: true,
    })

    // Verify connection
    const isHealthy = await db.ping()
    if (!isHealthy) {
      throw new Error('Database connection failed')
    }

    console.log('✅ Connected to test database')
  })

  afterAll(async () => {
    // Cleanup: Delete test user if created
    if (testUserId) {
      await db.deleteById('users', testUserId)
    }
  })
  // -------------------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------------------

  describe('Health Check', () => {
    it('should ping database successfully', async () => {
      const isHealthy = await db.ping()
      expect(isHealthy).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // QUERY OPERATIONS
  // -------------------------------------------------------------------------

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create test user
      const { data: user } = await db.insert('users', {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
      })

      if (user && 'id' in user) {
        testUserId = user.id as string
      }
    })

    it('should find user by ID', async () => {
      const { data: user, error } = await db.findById('users', testUserId)

      expect(error).toBeNull()
      expect(user).not.toBeNull()
      expect(user).toHaveProperty('id', testUserId)
      expect(user).toHaveProperty('email')
    })

    it('should find users with filters', async () => {
      const { data: users, error } = await db.find('users', {
        filters: [
          { column: 'id', operator: '=', value: testUserId },
        ],
      })

      expect(error).toBeNull()
      expect(users).toHaveLength(1)
      expect(users?.[0]).toHaveProperty('id', testUserId)
    })

    it('should count users', async () => {
      const { data: count, error } = await db.count('users')

      expect(error).toBeNull()
      expect(count).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // MUTATION OPERATIONS
  // -------------------------------------------------------------------------

  describe('Mutation Operations', () => {
    it('should insert a new user', async () => {
      const email = `test-insert-${Date.now()}@example.com`

      const { data: user, error } = await db.insert('users', {
        email,
        name: 'Insert Test User',
      })

      expect(error).toBeNull()
      expect(user).not.toBeNull()
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email', email)

      // Cleanup
      if (user && 'id' in user) {
        await db.deleteById('users', user.id as string)
      }
    })

    it('should update user by ID', async () => {
      // Create test user
      const { data: user } = await db.insert('users', {
        email: `test-update-${Date.now()}@example.com`,
        name: 'Update Test User',
      })

      expect(user).not.toBeNull()
      const userId = (user as any).id

      // Update user
      const { data: updated, error } = await db.updateById('users', userId, {
        name: 'Updated Name',
      })

      expect(error).toBeNull()
      expect(updated).toHaveProperty('name', 'Updated Name')

      // Cleanup
      await db.deleteById('users', userId)
    })

    it('should delete user by ID', async () => {
      // Create test user
      const { data: user } = await db.insert('users', {
        email: `test-delete-${Date.now()}@example.com`,
        name: 'Delete Test User',
      })

      expect(user).not.toBeNull()
      const userId = (user as any).id

      // Delete user
      const { data: success, error } = await db.deleteById('users', userId)

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify deletion
      const { data: deletedUser } = await db.findById('users', userId)
      expect(deletedUser).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // PAGINATION
  // -------------------------------------------------------------------------

  describe('Pagination', () => {
    beforeAll(async () => {
      // Create 5 test users
      for (let i = 0; i < 5; i++) {
        await db.insert('users', {
          email: `test-pagination-${i}-${Date.now()}@example.com`,
          name: `Pagination User ${i}`,
        })
      }
    })

    it('should paginate results with limit', async () => {
      const { data: users, error } = await db.find('users', {
        limit: 3,
      })

      expect(error).toBeNull()
      expect(users).toHaveLength(3)
    })

    it('should paginate results with offset', async () => {
      const { data: page1 } = await db.find('users', { limit: 2, offset: 0 })
      const { data: page2 } = await db.find('users', { limit: 2, offset: 2 })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)

      // Pages should have different users
      const page1Ids = page1?.map((u: any) => u.id) || []
      const page2Ids = page2?.map((u: any) => u.id) || []

      expect(page1Ids).not.toEqual(page2Ids)
    })
  })

  // -------------------------------------------------------------------------
  // TRANSACTIONS
  // -------------------------------------------------------------------------

  describe('Transactions', () => {
    it('should execute operations in transaction', async () => {
      const email1 = `test-tx-1-${Date.now()}@example.com`
      const email2 = `test-tx-2-${Date.now()}@example.com`

      const { data: result, error } = await db.transaction(async (tx) => {
        await tx.insert('users', { email: email1, name: 'TX User 1' })
        await tx.insert('users', { email: email2, name: 'TX User 2' })
        return { success: true }
      })

      expect(error).toBeNull()
      expect(result).toEqual({ success: true })

      // Verify both users were inserted
      const { data: user1 } = await db.findOne('users', {
        filters: [{ column: 'email', operator: '=', value: email1 }],
      })
      const { data: user2 } = await db.findOne('users', {
        filters: [{ column: 'email', operator: '=', value: email2 }],
      })

      expect(user1).not.toBeNull()
      expect(user2).not.toBeNull()

      // Cleanup
      if (user1 && 'id' in user1) await db.deleteById('users', user1.id as string)
      if (user2 && 'id' in user2) await db.deleteById('users', user2.id as string)
    })
  })

  // -------------------------------------------------------------------------
  // STORAGE OPERATIONS
  // -------------------------------------------------------------------------

  describe('Storage Operations', () => {
    const testBucket = 'test-files'
    const testPath = `test-${Date.now()}.txt`

    it('should upload file', async () => {
      const fileContent = 'Hello, World!'
      const blob = new Blob([fileContent], { type: 'text/plain' })

      const { data: url, error } = await db.uploadFile(
        testBucket,
        testPath,
        blob,
        { contentType: 'text/plain' }
      )

      expect(error).toBeNull()
      expect(url).toContain(testPath)
    })

    it('should download file', async () => {
      const { data: blob, error } = await db.downloadFile(testBucket, testPath)

      expect(error).toBeNull()
      expect(blob).toBeInstanceOf(Blob)

      const text = await blob?.text()
      expect(text).toContain('Hello, World!')
    })

    it('should get file URL', () => {
      const url = db.getFileUrl(testBucket, testPath)

      expect(url).toContain(testBucket)
      expect(url).toContain(testPath)
    })

    it('should delete file', async () => {
      const { data: success, error } = await db.deleteFile(testBucket, testPath)

      expect(error).toBeNull()
      expect(success).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should handle non-existent record gracefully', async () => {
      const { data: user, error } = await db.findById('users', 'non-existent-id')

      expect(error).toBeNull()
      expect(user).toBeNull()
    })

    it('should handle invalid table name', async () => {
      const { data: users, error } = await db.find('non_existent_table')

      expect(error).not.toBeNull()
      expect(users).toBeNull()
    })

    it('should require filters for delete operation', async () => {
      const { data: success, error } = await db.delete('users')

      expect(error).not.toBeNull()
      expect(error?.message).toContain('filter')
      expect(success).toBeNull()
    })
  })
})
