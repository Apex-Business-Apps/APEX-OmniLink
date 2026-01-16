/**
 * RAG Infrastructure Validation Tests
 *
 * Tests the APEX-OmniHub RAG implementation
 * Note: tradeline247-railway does NOT have RAG, but APEX-OmniHub does
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const OMNIHUB_PATH = '/home/user/APEX-OmniHub';

describe('APEX-OmniHub RAG Infrastructure', () => {
  let skillLoaderCode;
  let typesCode;
  let migrationSql;

  beforeAll(() => {
    skillLoaderCode = readFileSync(
      join(OMNIHUB_PATH, 'supabase/functions/_shared/skill-loader.ts'),
      'utf-8'
    );
    typesCode = readFileSync(
      join(OMNIHUB_PATH, 'supabase/functions/_shared/types.ts'),
      'utf-8'
    );
    migrationSql = readFileSync(
      join(OMNIHUB_PATH, 'supabase/migrations/20251221000000_omnilink_agentic_rag.sql'),
      'utf-8'
    );
  });

  describe('Database Schema (SQL Migration)', () => {
    it('Should create agent_skills table with vector column', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.agent_skills');
      expect(migrationSql).toContain('embedding vector(384)');
    });

    it('Should create HNSW index for vector similarity', () => {
      expect(migrationSql).toContain('USING hnsw (embedding vector_cosine_ops)');
      expect(migrationSql).toContain('m = 16');
      expect(migrationSql).toContain('ef_construction = 64');
    });

    it('Should create GIN index for full-text search', () => {
      expect(migrationSql).toContain('USING gin (fts)');
    });

    it('Should create match_skills RPC with hybrid search', () => {
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.match_skills');
      expect(migrationSql).toContain('query_embedding vector(384)');
      expect(migrationSql).toContain('query_text text');
    });

    it('Should implement Reciprocal Rank Fusion (RRF)', () => {
      expect(migrationSql).toContain('Reciprocal Rank Fusion');
      expect(migrationSql).toContain('rrf_score');
      expect(migrationSql).toContain('semantic_search');
      expect(migrationSql).toContain('keyword_search');
    });

    it('Should enable RLS on agent_skills', () => {
      expect(migrationSql).toContain('ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY');
    });

    it('Should create agent_checkpoints table for state persistence', () => {
      expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.agent_checkpoints');
      expect(migrationSql).toContain('thread_id text PRIMARY KEY');
      expect(migrationSql).toContain('state jsonb NOT NULL');
    });
  });

  describe('SkillRegistry Class', () => {
    it('Should export SkillRegistry class', () => {
      expect(skillLoaderCode).toContain('export class SkillRegistry');
    });

    it('Should initialize Supabase AI session', () => {
      expect(skillLoaderCode).toContain('initializeAISession');
      expect(skillLoaderCode).toContain("model: 'gte-small'");
    });

    it('Should implement registerSkill method', () => {
      expect(skillLoaderCode).toContain('async registerSkill(skill: SkillDefinition)');
    });

    it('Should generate embeddings for skills', () => {
      expect(skillLoaderCode).toContain('this.aiSession.run');
      expect(skillLoaderCode).toContain('mean_pool: true');
      expect(skillLoaderCode).toContain('normalize: true');
    });

    it('Should implement retrieveSkills with hybrid search', () => {
      expect(skillLoaderCode).toContain('async retrieveSkills(query: string');
      expect(skillLoaderCode).toContain("rpc('match_skills'");
    });

    it('Should implement getAllSkills method', () => {
      expect(skillLoaderCode).toContain('async getAllSkills()');
    });

    it('Should implement removeSkill method', () => {
      expect(skillLoaderCode).toContain('async removeSkill(skillName: string)');
    });

    it('Should sanitize inputs', () => {
      expect(skillLoaderCode).toContain('skill.name.trim()');
      expect(skillLoaderCode).toContain('skill.description.trim()');
      expect(skillLoaderCode).toContain('query.trim()');
    });

    it('Should handle errors appropriately', () => {
      expect(skillLoaderCode).toContain("throw new Error('Skill name and description are required')");
      expect(skillLoaderCode).toContain("throw new Error('Embedding generation failed");
      expect(skillLoaderCode).toContain("Skill registration failed:");
    });
  });

  describe('Type Definitions', () => {
    it('Should define SkillDefinition type', () => {
      expect(typesCode).toContain('export type SkillDefinition');
      expect(typesCode).toContain('name: string');
      expect(typesCode).toContain('description: string');
      expect(typesCode).toContain('parameters: JsonSchema');
    });

    it('Should define AgentState type', () => {
      expect(typesCode).toContain('export type AgentState');
      expect(typesCode).toContain('threadId: string');
      expect(typesCode).toContain('messages:');
      expect(typesCode).toContain('current_skills:');
    });

    it('Should define SkillMatch type', () => {
      expect(typesCode).toContain('export type SkillMatch');
      expect(typesCode).toContain('tool_definition: JsonSchema');
      expect(typesCode).toContain('score: number');
    });

    it('Should define Tri-Force Architecture types', () => {
      expect(typesCode).toContain('export interface PlanStep');
      expect(typesCode).toContain('export interface GuardianResult');
      expect(typesCode).toContain('export interface AgentResponse');
    });
  });

  describe('Integration Points', () => {
    it('Should have RAG test file', () => {
      const testPath = join(OMNIHUB_PATH, 'tests/agent-rag-test.ts');
      expect(existsSync(testPath)).toBe(true);
    });
  });
});

describe('tradeline247-railway RAG Integration Gap', () => {
  const TRADELINE_PATH = '/home/user/tradeline247-railway-audit/tradeline-voice-server';

  it('CONFIRMS: tradeline247 does NOT use SkillRegistry', () => {
    const serverCode = readFileSync(join(TRADELINE_PATH, 'server.mjs'), 'utf-8');
    expect(serverCode).not.toContain('SkillRegistry');
  });

  it('CONFIRMS: tradeline247 does NOT have Supabase client', () => {
    const serverCode = readFileSync(join(TRADELINE_PATH, 'server.mjs'), 'utf-8');
    expect(serverCode).not.toContain('supabase');
    expect(serverCode).not.toContain('@supabase/supabase-js');
  });

  it('CONFIRMS: tradeline247 uses hardcoded TOOLS array', () => {
    const serverCode = readFileSync(join(TRADELINE_PATH, 'server.mjs'), 'utf-8');
    expect(serverCode).toContain('const TOOLS = [');
  });

  it('CONFIRMS: tradeline247 does NOT call match_skills RPC', () => {
    const serverCode = readFileSync(join(TRADELINE_PATH, 'server.mjs'), 'utf-8');
    expect(serverCode).not.toContain('match_skills');
    expect(serverCode).not.toContain('retrieveSkills');
  });
});

describe('RAG Architecture Quality Assessment', () => {
  let migrationSql;

  beforeAll(() => {
    migrationSql = readFileSync(
      join(OMNIHUB_PATH, 'supabase/migrations/20251221000000_omnilink_agentic_rag.sql'),
      'utf-8'
    );
  });

  it('Uses appropriate embedding dimension (384 for gte-small)', () => {
    expect(migrationSql).toContain('vector(384)');
  });

  it('Uses SECURITY INVOKER for RPC (recommended practice)', () => {
    expect(migrationSql).toContain('SECURITY INVOKER');
  });

  it('Sets explicit search_path (SQL injection protection)', () => {
    expect(migrationSql).toContain('SET search_path = public');
  });

  it('Uses cosine distance for similarity (industry standard)', () => {
    expect(migrationSql).toContain('vector_cosine_ops');
    expect(migrationSql).toContain('<=>'); // Cosine distance operator
  });

  it('Implements proper hybrid search weighting (70% semantic, 30% keyword)', () => {
    expect(migrationSql).toContain('0.7');
    expect(migrationSql).toContain('0.3');
  });
});
