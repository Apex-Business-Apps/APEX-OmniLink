-- Migration: OmniLink Agentic RAG Infrastructure
-- Creates agent_skills table with vector search, RLS policies, and hybrid search RPC

-- Enable pgvector extension (use extensions schema if required by project standard)
CREATE EXTENSION IF NOT EXISTS vector;

-- agent_skills table for dynamic skill registry
CREATE TABLE IF NOT EXISTS public.agent_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text NOT NULL,
    tool_definition jsonb NOT NULL,
    embedding vector(384) NOT NULL,  -- gte-small dimension
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Full-text search support for hybrid search
ALTER TABLE public.agent_skills
ADD COLUMN IF NOT EXISTS fts tsvector
GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))
) STORED;

-- HNSW index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS agent_skills_embedding_hnsw
ON public.agent_skills
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS agent_skills_fts_gin
ON public.agent_skills
USING gin (fts);

-- Enable Row Level Security
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read skills
CREATE POLICY "agent_skills_select_authenticated" ON public.agent_skills
FOR SELECT
TO authenticated
USING (true);

-- Allow service_role full access (for skill registration)
DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['agent_skills', 'agent_checkpoints'] LOOP
    policy_name := format('%s_all_service_role', table_name);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY "%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

-- Hybrid search RPC function (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.match_skills(
    query_embedding vector(384),
    query_text text,
    match_threshold float DEFAULT 0.1,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    tool_definition jsonb,
    metadata jsonb,
    created_at timestamptz,
    score float
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    -- Use Reciprocal Rank Fusion (RRF) for hybrid search
    WITH semantic_search AS (
        SELECT
            id,
            name,
            description,
            tool_definition,
            metadata,
            created_at,
            1 - (embedding <=> query_embedding) as semantic_score
        FROM agent_skills
        WHERE 1 - (embedding <=> query_embedding) >= match_threshold
        ORDER BY semantic_score DESC
        LIMIT match_count * 4  -- buffer for RRF
    ),
    keyword_search AS (
        SELECT
            id,
            name,
            description,
            tool_definition,
            metadata,
            created_at,
            ts_rank(fts, plainto_tsquery('english', query_text)) as keyword_score
        FROM agent_skills
        WHERE fts @@ plainto_tsquery('english', query_text)
        ORDER BY keyword_score DESC
        LIMIT match_count * 4  -- buffer for RRF
    ),
    combined_results AS (
        SELECT
            COALESCE(s.id, k.id) as id,
            COALESCE(s.name, k.name) as name,
            COALESCE(s.description, k.description) as description,
            COALESCE(s.tool_definition, k.tool_definition) as tool_definition,
            COALESCE(s.metadata, k.metadata) as metadata,
            COALESCE(s.created_at, k.created_at) as created_at,
            COALESCE(s.semantic_score, 0) as semantic_score,
            COALESCE(k.keyword_score, 0) as keyword_score,
            -- RRF score calculation
            CASE
                WHEN s.id IS NOT NULL AND k.id IS NOT NULL THEN
                    0.7 / (60 + ROW_NUMBER() OVER (ORDER BY s.semantic_score DESC)) +
                    0.3 / (60 + ROW_NUMBER() OVER (ORDER BY k.keyword_score DESC))
                WHEN s.id IS NOT NULL THEN
                    0.7 / (60 + ROW_NUMBER() OVER (ORDER BY s.semantic_score DESC))
                ELSE
                    0.3 / (60 + ROW_NUMBER() OVER (ORDER BY k.keyword_score DESC))
            END as rrf_score
        FROM semantic_search s
        FULL OUTER JOIN keyword_search k ON s.id = k.id
    )
    SELECT
        id,
        name,
        description,
        tool_definition,
        metadata,
        created_at,
        rrf_score as score
    FROM combined_results
    ORDER BY rrf_score DESC
    LIMIT match_count;
$$;

-- agent_checkpoints table for thread state persistence
CREATE TABLE IF NOT EXISTS public.agent_checkpoints (
    thread_id text PRIMARY KEY,
    user_id uuid NOT NULL DEFAULT auth.uid(),
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on checkpoints
ALTER TABLE public.agent_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checkpoints
-- Users can only access their own checkpoints
CREATE POLICY "agent_checkpoints_crud_own" ON public.agent_checkpoints
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Index for efficient user-based queries
CREATE INDEX IF NOT EXISTS agent_checkpoints_user_id_idx
ON public.agent_checkpoints (user_id);

-- Index for efficient thread-based queries
CREATE INDEX IF NOT EXISTS agent_checkpoints_thread_id_idx
ON public.agent_checkpoints (thread_id);
