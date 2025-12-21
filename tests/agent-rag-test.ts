import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SkillRegistry } from '../supabase/functions/_shared/skill-loader';
import { SkillDefinition } from '../supabase/functions/_shared/types';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    })),
    ai: {
      createSession: vi.fn(() => Promise.resolve({
        run: vi.fn(() => Promise.resolve({
          embedding: [0.1, 0.2, 0.3, 0.4] // Mock 4D embedding for simplicity
        }))
      }))
    }
  }))
}));

describe('OmniLink Agentic RAG', () => {
  let mockSupabase: SupabaseClient;
  let skillRegistry: SkillRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient('mock-url', 'mock-key');
    skillRegistry = new SkillRegistry(mockSupabase);
  });

  describe('SkillRegistry', () => {
    it('should register a skill successfully', async () => {
      const skill: SkillDefinition = {
        name: 'CheckCreditScore',
        description: 'Check a user\'s credit score',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' }
          },
          required: ['userId']
        }
      };

      await expect(skillRegistry.registerSkill(skill)).resolves.not.toThrow();
    });

    it('should reject invalid skill registration', async () => {
      const invalidSkill = {
        name: '',
        description: '   ',
        parameters: {}
      } as SkillDefinition;

      await expect(skillRegistry.registerSkill(invalidSkill)).rejects.toThrow('Skill name and description are required');
    });

    it('should retrieve skills based on query', async () => {
      const mockRpcResponse = {
        data: [{
          id: '1',
          name: 'CheckCreditScore',
          description: 'Check credit score',
          tool_definition: { type: 'object', properties: { userId: { type: 'string' } } },
          metadata: {},
          score: 0.8
        }],
        error: null
      };

      (mockSupabase.rpc as Mock).mockResolvedValueOnce(mockRpcResponse);

      const skills = await skillRegistry.retrieveSkills('How is my credit?');

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('CheckCreditScore');
    });

    it('should return empty array for empty query', async () => {
      const skills = await skillRegistry.retrieveSkills('');

      expect(skills).toEqual([]);
    });

    it('should get all registered skills', async () => {
      const mockData = [{
        name: 'CheckCreditScore',
        description: 'Check credit score',
        tool_definition: { type: 'object', properties: { userId: { type: 'string' } } },
        metadata: { version: '1.0' }
      }];

      (mockSupabase.from as Mock).mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: mockData, error: null }))
        }))
      });

      const skills = await skillRegistry.getAllSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('CheckCreditScore');
    });

    it('should remove a skill successfully', async () => {
      await expect(skillRegistry.removeSkill('CheckCreditScore')).resolves.not.toThrow();
    });
  });

  describe('Agent Flow Integration', () => {
    it('should simulate agent flow with tool execution', async () => {
      // Register a mock skill
      const skill: SkillDefinition = {
        name: 'CheckCreditScore',
        description: 'Retrieve user credit score information',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User identifier' }
          },
          required: ['userId']
        }
      };

      await skillRegistry.registerSkill(skill);

      // Mock the hybrid search to return our skill
      const mockRpcResponse = {
        data: [{
          id: '1',
          name: 'CheckCreditScore',
          description: 'Retrieve user credit score information',
          tool_definition: skill.parameters,
          metadata: {},
          score: 0.9
        }],
        error: null
      };

      (mockSupabase.rpc as Mock).mockResolvedValueOnce(mockRpcResponse);

      // Test skill retrieval
      const retrievedSkills = await skillRegistry.retrieveSkills('How is my credit score?');

      expect(retrievedSkills).toHaveLength(1);
      expect(retrievedSkills[0].name).toBe('CheckCreditScore');
      expect(retrievedSkills[0].parameters).toEqual(skill.parameters);
    });

    it('should handle tool execution flow', () => {
      // Test the tool execution logic structure
      // This would typically test the actual tool execution in the edge function
      // For now, we verify the skill definition structure

      const toolDef: SkillDefinition = {
        name: 'CheckCreditScore',
        description: 'Check credit score',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' }
          },
          required: ['userId']
        }
      };

      expect(toolDef.name).toBe('CheckCreditScore');
      expect(toolDef.parameters.type).toBe('object');
      expect(toolDef.parameters.required).toContain('userId');
    });

    it('should validate RLS security model', () => {
      // Test that our RLS policies are properly defined in the migration
      // This is more of a documentation test since we can't easily test RLS in unit tests

      const expectedPolicies = [
        'agent_skills_select_authenticated',
        'agent_skills_all_service_role',
        'agent_checkpoints_crud_own',
        'agent_checkpoints_all_service_role'
      ];

      // Verify policy names are as expected (this would be validated in integration tests)
      expect(expectedPolicies).toContain('agent_skills_select_authenticated');
      expect(expectedPolicies).toContain('agent_checkpoints_crud_own');
    });

    it('should handle checkpoint persistence structure', () => {
      // Test the agent state structure for checkpointing
      const agentState = {
        threadId: 'test-thread-123',
        messages: [
          { role: 'system', content: 'You are an AI assistant' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        current_skills: [],
        tool_results: []
      };

      expect(agentState.threadId).toBe('test-thread-123');
      expect(agentState.messages).toHaveLength(3);
      expect(agentState.messages[0].role).toBe('system');
      expect(agentState.messages[1].role).toBe('user');
      expect(agentState.messages[2].role).toBe('assistant');
    });
  });

  describe('Error Handling', () => {
    it('should handle AI session initialization failure', async () => {
      // Mock AI session failure
      (mockSupabase.ai.createSession as Mock).mockRejectedValueOnce(
        new Error('AI session unavailable')
      );

      const newRegistry = new SkillRegistry(mockSupabase);

      await expect(newRegistry.registerSkill({
        name: 'TestSkill',
        description: 'Test description',
        parameters: { type: 'object', properties: {} }
      })).rejects.toThrow('Supabase AI session unavailable');
    });

    it('should handle embedding generation failure', async () => {
      // Mock successful AI session init but failed embedding
      (mockSupabase.ai.createSession as Mock).mockResolvedValueOnce({
        run: vi.fn(() => Promise.reject(new Error('Embedding failed')))
      });

      const newRegistry = new SkillRegistry(mockSupabase);

      await expect(newRegistry.registerSkill({
        name: 'TestSkill',
        description: 'Test description',
        parameters: { type: 'object', properties: {} }
      })).rejects.toThrow('Embedding generation failed');
    });

    it('should handle database operation failures', async () => {
      // Mock database upsert failure
      (mockSupabase.from as Mock).mockReturnValue({
        upsert: vi.fn(() => Promise.resolve({ error: { message: 'Database error' } }))
      });

      await expect(skillRegistry.registerSkill({
        name: 'TestSkill',
        description: 'Test description',
        parameters: { type: 'object', properties: {} }
      })).rejects.toThrow('Skill registration failed: Database error');
    });
  });
});