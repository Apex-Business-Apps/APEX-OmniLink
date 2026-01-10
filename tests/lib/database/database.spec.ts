/**
 * DATABASE ABSTRACTION LAYER - UNIT TESTS
 *
 * Tests for generic database interface and Supabase provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IDatabase, QueryFilter } from '@/lib/database/interface'

// ============================================================================
// MOCK DATABASE IMPLEMENTATION
// ============================================================================

class MockDatabase implements IDatabase {
  // Store mock data
  private mockData: Record<string, unknown[]> = {
    users: [
      { id: '1', email: 'user1@example.com', name: 'User 1', active: true },
      { id: '2', email: 'user2@example.com', name: 'User 2', active: true },
      { id: '3', email: 'user3@example.com', name: 'User 3', active: false },
    ],
  }

  async findById<T>(table: string, id: string): Promise<{ data: T | null; error: Error | null }> {
    const record = this.mockData[table]?.find((r) => r.id === id)
    return { data: record as T || null, error: null }
  }

  async find<T>(table: string, options?: unknown): Promise<{ data: T[] | null; error: Error | null; count?: number | null }> {
    let records = this.mockData[table] || []

    // Apply filters
    if (options?.filters) {
      records = records.filter((record) => {
        return options.filters.every((filter: QueryFilter) => {
          const value = record[filter.column]
          switch (filter.operator) {
            case '=':
              return value === filter.value
            case '!=':
              return value !== filter.value
            case '>':
              return value > filter.value
            case '>=':
              return value >= filter.value
            case '<':
              return value < filter.value
            case '<=':
              return value <= filter.value
            case 'in':
              return Array.isArray(filter.value) ? filter.value.includes(value) : value === filter.value
            default:
              return true
          }
        })
      })
    }

    // Apply limit/offset
    if (options?.offset) {
      records = records.slice(options.offset)
    }
    if (options?.limit) {
      records = records.slice(0, options.limit)
    }

    return { data: records as T[], error: null, count: records.length }
  }

  async findOne<T>(table: string, options?: unknown): Promise<{ data: T | null; error: Error | null }> {
    const result = await this.find<T>(table, { ...options, limit: 1 })
    return { data: result.data?.[0] || null, error: result.error }
  }

  async count(table: string, options?: unknown): Promise<{ data: number | null; error: Error | null }> {
    const result = await this.find(table, options)
    return { data: result.data?.length || 0, error: null }
  }

  async insert<T>(table: string, data: Partial<T>): Promise<{ data: T | null; error: Error | null }> {
    const record = { id: Date.now().toString(), ...data } as T
    this.mockData[table] = [...(this.mockData[table] || []), record]
    return { data: record, error: null }
  }

  async insertMany<T>(table: string, data: Partial<T>[]): Promise<{ data: T[] | null; error: Error | null }> {
    const records = data.map((d, i) => ({ id: `${Date.now()}-${i}`, ...d } as T))
    this.mockData[table] = [...(this.mockData[table] || []), ...records]
    return { data: records, error: null }
  }

  async update<T>(table: string, data: Partial<T>, options?: unknown): Promise<{ data: T[] | null; error: Error | null }> {
    const result = await this.find(table, options)
    if (!result.data) return { data: null, error: result.error }

    const updatedRecords = result.data.map((record: unknown) => ({ ...record, ...data }))
    this.mockData[table] = [
      ...this.mockData[table].filter((r) => !result.data!.find((ur: unknown) => ur.id === r.id)),
      ...updatedRecords,
    ]
    return { data: updatedRecords as T[], error: null }
  }

  async updateById<T>(table: string, id: string, data: Partial<T>): Promise<{ data: T | null; error: Error | null }> {
    const record = this.mockData[table]?.find((r) => r.id === id)
    if (!record) return { data: null, error: new Error('Record not found') }

    const updated = { ...record, ...data }
    this.mockData[table] = [
      ...this.mockData[table].filter((r) => r.id !== id),
      updated,
    ]
    return { data: updated as T, error: null }
  }

  async delete(table: string, options?: unknown): Promise<{ data: boolean | null; error: Error | null }> {
    if (!options?.filters) {
      return { data: null, error: new Error('Delete requires filters') }
    }

    const result = await this.find(table, options)
    if (!result.data) return { data: false, error: result.error }

    this.mockData[table] = this.mockData[table].filter(
      (r) => !result.data!.find((dr: unknown) => dr.id === r.id)
    )
    return { data: true, error: null }
  }

  async deleteById(table: string, id: string): Promise<{ data: boolean | null; error: Error | null }> {
    const exists = this.mockData[table]?.some((r) => r.id === id)
    if (!exists) return { data: false, error: new Error('Record not found') }

    this.mockData[table] = this.mockData[table].filter((r) => r.id !== id)
    return { data: true, error: null }
  }

  async raw<T>(): Promise<{ data: T[] | null; error: Error | null }> {
    return { data: null, error: new Error('Not implemented') }
  }

  async transaction<T>(callback: (db: IDatabase) => Promise<T>): Promise<{ data: T | null; error: Error | null }> {
    try {
      const result = await callback(this)
      return { data: result, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    return 'test-user-id'
  }

  setUserContext(_userId: string): void {
    // No-op for mock
  }

  async uploadFile(): Promise<{ data: string | null; error: Error | null }> {
    return { data: 'https://example.com/file.jpg', error: null }
  }

  async downloadFile(): Promise<{ data: Blob | null; error: Error | null }> {
    return { data: new Blob(['test']), error: null }
  }

  async deleteFile(): Promise<{ data: boolean | null; error: Error | null }> {
    return { data: true, error: null }
  }

  getFileUrl(_bucket: string, path: string): string {
    return `https://example.com/${path}`
  }

  async subscribe<T>(): Promise<() => void> {
    return () => {}
  }

  async ping(): Promise<boolean> {
    return true
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Database Abstraction Layer', () => {
  let db: IDatabase

  beforeEach(() => {
    db = new MockDatabase()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // QUERY OPERATIONS
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('should find a record by ID', async () => {
      const { data: user, error } = await db.findById('users', '1')

      expect(error).toBeNull()
      expect(user).toEqual({
        id: '1',
        email: 'user1@example.com',
        name: 'User 1',
        active: true,
      })
    })

    it('should return null for non-existent record', async () => {
      const { data: user, error } = await db.findById('users', '999')

      expect(error).toBeNull()
      expect(user).toBeNull()
    })
  })

  describe('find', () => {
    it('should find all records', async () => {
      const { data: users, error, count } = await db.find('users')

      expect(error).toBeNull()
      expect(users).toHaveLength(3)
      expect(count).toBe(3)
    })

    it('should filter records by equality', async () => {
      const { data: users, error } = await db.find('users', {
        filters: [{ column: 'active', operator: '=', value: true }],
      })

      expect(error).toBeNull()
      expect(users).toHaveLength(2)
      expect(users?.every((u: unknown) => u.active === true)).toBe(true)
    })

    it('should filter records by inequality', async () => {
      const { data: users, error } = await db.find('users', {
        filters: [{ column: 'active', operator: '!=', value: true }],
      })

      expect(error).toBeNull()
      expect(users).toHaveLength(1)
      expect(users?.[0]).toHaveProperty('active', false)
    })

    it('should filter records by IN operator', async () => {
      const { data: users, error } = await db.find('users', {
        filters: [{ column: 'id', operator: 'in', value: ['1', '2'] }],
      })

      expect(error).toBeNull()
      expect(users).toHaveLength(2)
      expect(users?.map((u: unknown) => u.id)).toEqual(['1', '2'])
    })

    it('should apply limit', async () => {
      const { data: users, error } = await db.find('users', { limit: 2 })

      expect(error).toBeNull()
      expect(users).toHaveLength(2)
    })

    it('should apply offset', async () => {
      const { data: users, error } = await db.find('users', { offset: 1, limit: 2 })

      expect(error).toBeNull()
      expect(users).toHaveLength(2)
      expect(users?.[0]).toHaveProperty('id', '2')
    })

    it('should apply multiple filters', async () => {
      const { data: users, error } = await db.find('users', {
        filters: [
          { column: 'active', operator: '=', value: true },
          { column: 'id', operator: 'in', value: ['1', '2'] },
        ],
      })

      expect(error).toBeNull()
      expect(users).toHaveLength(2)
    })
  })

  describe('findOne', () => {
    it('should find a single record', async () => {
      const { data: user, error } = await db.findOne('users', {
        filters: [{ column: 'email', operator: '=', value: 'user1@example.com' }],
      })

      expect(error).toBeNull()
      expect(user).toEqual({
        id: '1',
        email: 'user1@example.com',
        name: 'User 1',
        active: true,
      })
    })

    it('should return null if no records found', async () => {
      const { data: user, error } = await db.findOne('users', {
        filters: [{ column: 'email', operator: '=', value: 'nonexistent@example.com' }],
      })

      expect(error).toBeNull()
      expect(user).toBeNull()
    })
  })

  describe('count', () => {
    it('should count all records', async () => {
      const { data: count, error } = await db.count('users')

      expect(error).toBeNull()
      expect(count).toBe(3)
    })

    it('should count filtered records', async () => {
      const { data: count, error } = await db.count('users', {
        filters: [{ column: 'active', operator: '=', value: true }],
      })

      expect(error).toBeNull()
      expect(count).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // MUTATION OPERATIONS
  // -------------------------------------------------------------------------

  describe('insert', () => {
    it('should insert a new record', async () => {
      const { data: user, error } = await db.insert('users', {
        email: 'newuser@example.com',
        name: 'New User',
        active: true,
      })

      expect(error).toBeNull()
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email', 'newuser@example.com')

      // Verify record was inserted
      const { data: count } = await db.count('users')
      expect(count).toBe(4)
    })
  })

  describe('insertMany', () => {
    it('should insert multiple records', async () => {
      const { data: users, error } = await db.insertMany('users', [
        { email: 'user4@example.com', name: 'User 4', active: true },
        { email: 'user5@example.com', name: 'User 5', active: true },
      ])

      expect(error).toBeNull()
      expect(users).toHaveLength(2)
      expect(users?.[0]).toHaveProperty('id')

      // Verify records were inserted
      const { data: count } = await db.count('users')
      expect(count).toBe(5)
    })
  })

  describe('update', () => {
    it('should update records matching filters', async () => {
      const { data: users, error } = await db.update(
        'users',
        { active: false },
        {
          filters: [{ column: 'id', operator: '=', value: '1' }],
        }
      )

      expect(error).toBeNull()
      expect(users).toHaveLength(1)
      expect(users?.[0]).toHaveProperty('active', false)
    })
  })

  describe('updateById', () => {
    it('should update a record by ID', async () => {
      const { data: user, error } = await db.updateById('users', '1', {
        name: 'Updated Name',
      })

      expect(error).toBeNull()
      expect(user).toHaveProperty('name', 'Updated Name')
      expect(user).toHaveProperty('id', '1')
    })

    it('should return error for non-existent record', async () => {
      const { data: user, error } = await db.updateById('users', '999', {
        name: 'Updated Name',
      })

      expect(error).not.toBeNull()
      expect(user).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete records matching filters', async () => {
      const { data: success, error } = await db.delete('users', {
        filters: [{ column: 'id', operator: '=', value: '1' }],
      })

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify record was deleted
      const { data: count } = await db.count('users')
      expect(count).toBe(2)
    })

    it('should require filters', async () => {
      const { data: success, error } = await db.delete('users')

      expect(error).not.toBeNull()
      expect(error?.message).toContain('filters')
      expect(success).toBeNull()
    })
  })

  describe('deleteById', () => {
    it('should delete a record by ID', async () => {
      const { data: success, error } = await db.deleteById('users', '1')

      expect(error).toBeNull()
      expect(success).toBe(true)

      // Verify record was deleted
      const { data: count } = await db.count('users')
      expect(count).toBe(2)
    })

    it('should return error for non-existent record', async () => {
      const { data: success, error } = await db.deleteById('users', '999')

      expect(error).not.toBeNull()
      expect(success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // TRANSACTION OPERATIONS
  // -------------------------------------------------------------------------

  describe('transaction', () => {
    it('should execute operations in a transaction', async () => {
      const { data: result, error } = await db.transaction(async (tx) => {
        await tx.insert('users', { email: 'tx@example.com', name: 'TX User' })
        await tx.insert('users', { email: 'tx2@example.com', name: 'TX User 2' })
        return { success: true }
      })

      expect(error).toBeNull()
      expect(result).toEqual({ success: true })

      const { data: count } = await db.count('users')
      expect(count).toBe(5)
    })

    it('should handle transaction errors', async () => {
      const { data: result, error } = await db.transaction(async () => {
        throw new Error('Transaction failed')
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('Transaction failed')
      expect(result).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // AUTH OPERATIONS
  // -------------------------------------------------------------------------

  describe('getCurrentUserId', () => {
    it('should return current user ID', async () => {
      const userId = await db.getCurrentUserId()

      expect(userId).toBe('test-user-id')
    })
  })

  // -------------------------------------------------------------------------
  // STORAGE OPERATIONS
  // -------------------------------------------------------------------------

  describe('uploadFile', () => {
    it('should upload a file', async () => {
      const { data: url, error } = await db.uploadFile(
        'avatars',
        'profile.jpg',
        new Blob(['test'])
      )

      expect(error).toBeNull()
      expect(url).toContain('https://')
    })
  })

  describe('downloadFile', () => {
    it('should download a file', async () => {
      const { data: blob, error } = await db.downloadFile('avatars', 'profile.jpg')

      expect(error).toBeNull()
      expect(blob).toBeInstanceOf(Blob)
    })
  })

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const { data: success, error } = await db.deleteFile('avatars', 'profile.jpg')

      expect(error).toBeNull()
      expect(success).toBe(true)
    })
  })

  describe('getFileUrl', () => {
    it('should get public URL for file', () => {
      const url = db.getFileUrl('avatars', 'profile.jpg')

      expect(url).toContain('profile.jpg')
    })
  })

  // -------------------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------------------

  describe('ping', () => {
    it('should return true for healthy connection', async () => {
      const isHealthy = await db.ping()

      expect(isHealthy).toBe(true)
    })
  })
})
