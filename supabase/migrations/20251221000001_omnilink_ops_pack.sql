-- Migration: OmniLink Ops Pack
-- Adds telemetry, evaluation, governance, and tuning capabilities
-- All changes are idempotent and safe for production

-- Governance fields for agent_skills table
DO $$
BEGIN
    -- Add governance columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'agent_skills' AND column_name = 'version') THEN
        ALTER TABLE public.agent_skills ADD COLUMN version text DEFAULT '1.0';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'agent_skills' AND column_name = 'is_active') THEN
        ALTER TABLE public.agent_skills ADD COLUMN is_active boolean DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'agent_skills' AND column_name = 'deprecated_at') THEN
        ALTER TABLE public.agent_skills ADD COLUMN deprecated_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'agent_skills' AND column_name = 'tenant_scope') THEN
        ALTER TABLE public.agent_skills ADD COLUMN tenant_scope jsonb DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'agent_skills' AND column_name = 'requires_strong_auth') THEN
        ALTER TABLE public.agent_skills ADD COLUMN requires_strong_auth boolean DEFAULT false;
    END IF;
END $$;

-- Create telemetry tables for observability
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id text NOT NULL,
    user_id uuid DEFAULT auth.uid(),
    start_time timestamptz NOT NULL DEFAULT now(),
    end_time timestamptz,
    status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
    total_duration_ms integer,
    user_message text,
    agent_response text,
    skills_used text[] DEFAULT '{}',
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS agent_runs_thread_id_idx ON public.agent_runs (thread_id);
CREATE INDEX IF NOT EXISTS agent_runs_user_id_idx ON public.agent_runs (user_id);
CREATE INDEX IF NOT EXISTS agent_runs_status_idx ON public.agent_runs (status);
CREATE INDEX IF NOT EXISTS agent_runs_created_at_idx ON public.agent_runs (created_at);

-- RLS for agent_runs
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_runs_select_own" ON public.agent_runs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "agent_runs_insert_own" ON public.agent_runs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_runs_update_own" ON public.agent_runs
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "agent_runs_all_service_role" ON public.agent_runs
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Skill matches telemetry table
CREATE TABLE IF NOT EXISTS public.skill_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE CASCADE,
    query_text text NOT NULL,
    skill_name text NOT NULL,
    score float NOT NULL,
    rank integer NOT NULL,
    search_type text NOT NULL DEFAULT 'hybrid' CHECK (search_type IN ('semantic', 'keyword', 'hybrid')),
    embedding_distance float,
    fts_rank float,
    final_score float,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for skill_matches
CREATE INDEX IF NOT EXISTS skill_matches_agent_run_id_idx ON public.skill_matches (agent_run_id);
CREATE INDEX IF NOT EXISTS skill_matches_skill_name_idx ON public.skill_matches (skill_name);
CREATE INDEX IF NOT EXISTS skill_matches_score_idx ON public.skill_matches (score DESC);

-- RLS for skill_matches
ALTER TABLE public.skill_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_matches_select_via_run" ON public.skill_matches
FOR SELECT TO authenticated
USING (agent_run_id IN (
    SELECT id FROM public.agent_runs WHERE user_id = auth.uid()
));

CREATE POLICY "skill_matches_insert_via_run" ON public.skill_matches
FOR INSERT TO authenticated
WITH CHECK (agent_run_id IN (
    SELECT id FROM public.agent_runs WHERE user_id = auth.uid()
));

CREATE POLICY "skill_matches_all_service_role" ON public.skill_matches
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Tool invocations telemetry table
CREATE TABLE IF NOT EXISTS public.tool_invocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE CASCADE,
    skill_match_id uuid REFERENCES public.skill_matches(id) ON DELETE CASCADE,
    tool_name text NOT NULL,
    start_time timestamptz NOT NULL DEFAULT now(),
    end_time timestamptz,
    duration_ms integer,
    status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
    input_args jsonb DEFAULT '{}'::jsonb,
    output_result jsonb,
    error_message text,
    requires_strong_auth boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for tool_invocations
CREATE INDEX IF NOT EXISTS tool_invocations_agent_run_id_idx ON public.tool_invocations (agent_run_id);
CREATE INDEX IF NOT EXISTS tool_invocations_skill_match_id_idx ON public.tool_invocations (skill_match_id);
CREATE INDEX IF NOT EXISTS tool_invocations_tool_name_idx ON public.tool_invocations (tool_name);
CREATE INDEX IF NOT EXISTS tool_invocations_status_idx ON public.tool_invocations (status);

-- RLS for tool_invocations
ALTER TABLE public.tool_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tool_invocations_select_via_run" ON public.tool_invocations
FOR SELECT TO authenticated
USING (agent_run_id IN (
    SELECT id FROM public.agent_runs WHERE user_id = auth.uid()
));

CREATE POLICY "tool_invocations_insert_via_run" ON public.tool_invocations
FOR INSERT TO authenticated
WITH CHECK (agent_run_id IN (
    SELECT id FROM public.agent_runs WHERE user_id = auth.uid()
));

CREATE POLICY "tool_invocations_all_service_role" ON public.tool_invocations
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Evaluation cases table
CREATE TABLE IF NOT EXISTS public.eval_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'security', 'performance', 'accuracy')),
    user_message text NOT NULL,
    expected_skills text[] DEFAULT '{}',
    expected_response_pattern text,
    difficulty text DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for eval_cases
CREATE INDEX IF NOT EXISTS eval_cases_category_idx ON public.eval_cases (category);
CREATE INDEX IF NOT EXISTS eval_cases_is_active_idx ON public.eval_cases (is_active);

-- RLS for eval_cases (read-only for authenticated, full access for service_role)
ALTER TABLE public.eval_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_cases_select_authenticated" ON public.eval_cases
FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "eval_cases_all_service_role" ON public.eval_cases
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Evaluation results table
CREATE TABLE IF NOT EXISTS public.eval_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_case_id uuid REFERENCES public.eval_cases(id) ON DELETE CASCADE,
    agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
    score float CHECK (score >= 0 AND score <= 100),
    verdict text NOT NULL CHECK (verdict IN ('pass', 'fail', 'partial', 'error')),
    skills_found text[] DEFAULT '{}',
    skills_expected text[] DEFAULT '{}',
    response_quality float CHECK (response_quality >= 0 AND response_quality <= 100),
    security_check_passed boolean DEFAULT true,
    performance_ms integer,
    error_message text,
    raw_response jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for eval_results
CREATE INDEX IF NOT EXISTS eval_results_eval_case_id_idx ON public.eval_results (eval_case_id);
CREATE INDEX IF NOT EXISTS eval_results_agent_run_id_idx ON public.eval_results (agent_run_id);
CREATE INDEX IF NOT EXISTS eval_results_verdict_idx ON public.eval_results (verdict);
CREATE INDEX IF NOT EXISTS eval_results_score_idx ON public.eval_results (score);

-- RLS for eval_results
ALTER TABLE public.eval_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eval_results_select_via_case" ON public.eval_results
FOR SELECT TO authenticated
USING (eval_case_id IN (
    SELECT id FROM public.eval_cases WHERE is_active = true
));

CREATE POLICY "eval_results_all_service_role" ON public.eval_results
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Update match_skills function to support HNSW tuning
CREATE OR REPLACE FUNCTION public.match_skills(
    query_embedding vector(384),
    query_text text,
    match_threshold float DEFAULT 0.1,
    match_count int DEFAULT 5,
    ef_search int DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    name text,
    description text,
    tool_definition jsonb,
    metadata jsonb,
    version text,
    is_active boolean,
    deprecated_at timestamptz,
    tenant_scope jsonb,
    requires_strong_auth boolean,
    score float
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    -- Set HNSW ef_search if provided for query-time tuning
    SELECT set_config('hnsw.ef_search', ef_search::text, false)
    WHERE ef_search IS NOT NULL;

    -- Use Reciprocal Rank Fusion (RRF) for hybrid search
    -- Only include active, non-deprecated skills
    WITH semantic_search AS (
        SELECT
            s.id,
            s.name,
            s.description,
            s.tool_definition,
            s.metadata,
            s.version,
            s.is_active,
            s.deprecated_at,
            s.tenant_scope,
            s.requires_strong_auth,
            1 - (s.embedding <=> query_embedding) as semantic_score
        FROM agent_skills s
        WHERE s.is_active = true
          AND s.deprecated_at IS NULL
          AND 1 - (s.embedding <=> query_embedding) >= match_threshold
        ORDER BY semantic_score DESC
        LIMIT match_count * 4
    ),
    keyword_search AS (
        SELECT
            s.id,
            s.name,
            s.description,
            s.tool_definition,
            s.metadata,
            s.version,
            s.is_active,
            s.deprecated_at,
            s.tenant_scope,
            s.requires_strong_auth,
            ts_rank(s.fts, plainto_tsquery('english', query_text)) as keyword_score
        FROM agent_skills s
        WHERE s.is_active = true
          AND s.deprecated_at IS NULL
          AND s.fts @@ plainto_tsquery('english', query_text)
        ORDER BY keyword_score DESC
        LIMIT match_count * 4
    ),
    combined_results AS (
        SELECT
            COALESCE(s.id, k.id) as id,
            COALESCE(s.name, k.name) as name,
            COALESCE(s.description, k.description) as description,
            COALESCE(s.tool_definition, k.tool_definition) as tool_definition,
            COALESCE(s.metadata, k.metadata) as metadata,
            COALESCE(s.version, k.version) as version,
            COALESCE(s.is_active, k.is_active) as is_active,
            COALESCE(s.deprecated_at, k.deprecated_at) as deprecated_at,
            COALESCE(s.tenant_scope, k.tenant_scope) as tenant_scope,
            COALESCE(s.requires_strong_auth, k.requires_strong_auth) as requires_strong_auth,
            COALESCE(s.semantic_score, 0) as semantic_score,
            COALESCE(k.keyword_score, 0) as keyword_score,
            -- Balanced RRF score calculation (70% semantic, 30% keyword)
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
        version,
        is_active,
        deprecated_at,
        tenant_scope,
        requires_strong_auth,
        rrf_score as score
    FROM combined_results
    ORDER BY rrf_score DESC
    LIMIT match_count;
$$;