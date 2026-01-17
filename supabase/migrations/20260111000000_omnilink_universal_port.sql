-- Migration: OmniLink Universal Integration Plane
-- Adds API keys, events, entities, orchestration requests, and rate limiting

-- Shared status enum to avoid duplicated literals
DO $$
DECLARE
  v_status_queued constant text := 'queued';
  v_status_denied constant text := 'denied';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'omnilink_status') THEN
    EXECUTE format(
      'CREATE TYPE public.omnilink_status AS ENUM (%L, %L, %L, %L, %L, %L)',
      v_status_queued,
      'running',
      'waiting_approval',
      'succeeded',
      'failed',
      v_status_denied
    );
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.omnilink_status_queued() RETURNS public.omnilink_status LANGUAGE sql IMMUTABLE AS $$ SELECT %L::public.omnilink_status $$',
    v_status_queued
  );

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.omnilink_status_denied() RETURNS public.omnilink_status LANGUAGE sql IMMUTABLE AS $$ SELECT %L::public.omnilink_status $$',
    v_status_denied
  );
END $$;

-- OmniLink API keys (hash-only storage, show secret once)
CREATE TABLE IF NOT EXISTS public.omnilink_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  name text,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_omnilink_api_keys_integration_id ON public.omnilink_api_keys(integration_id);
CREATE INDEX IF NOT EXISTS idx_omnilink_api_keys_tenant_id ON public.omnilink_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnilink_api_keys_prefix ON public.omnilink_api_keys(key_prefix);

ALTER TABLE public.omnilink_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own OmniLink keys" ON public.omnilink_api_keys
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND tenant_id = auth.uid());

CREATE POLICY "Service role manages OmniLink keys" ON public.omnilink_api_keys
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- OmniLink events (append-only)
CREATE TABLE IF NOT EXISTS public.omnilink_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  api_key_id uuid REFERENCES public.omnilink_api_keys(id) ON DELETE SET NULL NOT NULL,
  envelope_id text NOT NULL,
  idempotency_key text NOT NULL,
  source text NOT NULL,
  type text NOT NULL,
  subject text,
  time timestamptz NOT NULL,
  dataschema text,
  data jsonb NOT NULL,
  entity jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, envelope_id),
  UNIQUE (integration_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_omnilink_events_tenant_id ON public.omnilink_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnilink_events_integration_id ON public.omnilink_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_omnilink_events_received_at ON public.omnilink_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_omnilink_events_type ON public.omnilink_events(type);

ALTER TABLE public.omnilink_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own OmniLink events" ON public.omnilink_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND tenant_id = auth.uid());

CREATE POLICY "Service role inserts OmniLink events" ON public.omnilink_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- OmniLink entities (projection)
CREATE TABLE IF NOT EXISTS public.omnilink_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  entity_type text NOT NULL,
  external_id text NOT NULL,
  display_name text,
  last_event_id uuid REFERENCES public.omnilink_events(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, entity_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_omnilink_entities_tenant_id ON public.omnilink_entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnilink_entities_type ON public.omnilink_entities(entity_type);

ALTER TABLE public.omnilink_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own OmniLink entities" ON public.omnilink_entities
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND tenant_id = auth.uid());

CREATE POLICY "Service role upserts OmniLink entities" ON public.omnilink_entities
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- OmniLink orchestration requests (commands + workflows)
CREATE TABLE IF NOT EXISTS public.omnilink_orchestration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  api_key_id uuid REFERENCES public.omnilink_api_keys(id) ON DELETE SET NULL NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('command', 'workflow')),
  envelope_id text NOT NULL,
  idempotency_key text NOT NULL,
  source text NOT NULL,
  type text NOT NULL,
  time timestamptz NOT NULL,
  target jsonb,
  params jsonb,
  policy jsonb,
  status public.omnilink_status NOT NULL DEFAULT public.omnilink_status_queued(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, envelope_id),
  UNIQUE (integration_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_omnilink_orchestration_tenant_id ON public.omnilink_orchestration_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnilink_orchestration_status ON public.omnilink_orchestration_requests(status);

ALTER TABLE public.omnilink_orchestration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own OmniLink orchestration requests" ON public.omnilink_orchestration_requests
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND tenant_id = auth.uid());

CREATE POLICY "Service role inserts OmniLink orchestration requests" ON public.omnilink_orchestration_requests
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates OmniLink orchestration requests" ON public.omnilink_orchestration_requests
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- OmniLink runs and steps (status projection)
CREATE TABLE IF NOT EXISTS public.omnilink_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE NOT NULL,
  orchestration_request_id uuid REFERENCES public.omnilink_orchestration_requests(id) ON DELETE CASCADE,
  external_run_id text,
  status public.omnilink_status NOT NULL DEFAULT public.omnilink_status_queued(),
  policy jsonb,
  output jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnilink_runs_tenant_id ON public.omnilink_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnilink_runs_status ON public.omnilink_runs(status);

ALTER TABLE public.omnilink_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own OmniLink runs" ON public.omnilink_runs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND tenant_id = auth.uid());

CREATE POLICY "Service role manages OmniLink runs" ON public.omnilink_runs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.omnilink_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.omnilink_runs(id) ON DELETE CASCADE NOT NULL,
  step_name text NOT NULL,
  status public.omnilink_status NOT NULL DEFAULT public.omnilink_status_queued(),
  output jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnilink_run_steps_run_id ON public.omnilink_run_steps(run_id);

ALTER TABLE public.omnilink_run_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own OmniLink run steps" ON public.omnilink_run_steps
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND run_id IN (
    SELECT id FROM public.omnilink_runs WHERE tenant_id = auth.uid()
  ));

CREATE POLICY "Service role manages OmniLink run steps" ON public.omnilink_run_steps
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Admin RPC for key revocation
CREATE OR REPLACE FUNCTION public.omnilink_revoke_key(
  p_key_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.omnilink_api_keys
  SET revoked_at = now()
  WHERE id = p_key_id
    AND tenant_id = p_user_id;
END;
$$;

-- Admin RPC for approvals
CREATE OR REPLACE FUNCTION public.omnilink_set_approval(
  p_request_id uuid,
  p_user_id uuid,
  p_decision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decision_approved constant text := 'approved';
  v_decision_denied constant text := 'denied';
BEGIN
  IF NOT public.is_admin(p_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_decision NOT IN (v_decision_approved, v_decision_denied) THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  UPDATE public.omnilink_orchestration_requests
  SET status = CASE
    WHEN p_decision = v_decision_approved THEN public.omnilink_status_queued()
    ELSE public.omnilink_status_denied()
  END,
      updated_at = now()
  WHERE id = p_request_id
    AND tenant_id = p_user_id
    AND status = 'waiting_approval'::public.omnilink_status;
END;
$$;

-- OmniLink rate limit buckets
CREATE TABLE IF NOT EXISTS public.omnilink_rate_limits (
  api_key_id uuid REFERENCES public.omnilink_api_keys(id) ON DELETE CASCADE NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, window_start)
);

ALTER TABLE public.omnilink_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages OmniLink rate limits" ON public.omnilink_rate_limits
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- OmniLink ingest RPC (atomic rate limit + idempotent insert + entity projection + audit log)
CREATE OR REPLACE FUNCTION public.omnilink_ingest(
  p_api_key_id uuid,
  p_integration_id uuid,
  p_tenant_id uuid,
  p_request_type text,
  p_envelope jsonb,
  p_idempotency_key text,
  p_max_rpm int,
  p_entity jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := date_trunc('minute', now());
  v_new_count int;
  v_retry_after int;
  v_status text;
  v_record_id uuid;
  v_envelope_id text := p_envelope->>'id';
  v_source text := p_envelope->>'source';
  v_type text := p_envelope->>'type';
  v_subject text := p_envelope->>'subject';
  v_time timestamptz := (p_envelope->>'time')::timestamptz;
  v_dataschema text := p_envelope->>'dataschema';
BEGIN
  -- Rate limit check
  INSERT INTO public.omnilink_rate_limits(api_key_id, window_start, request_count)
  VALUES (p_api_key_id, v_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = public.omnilink_rate_limits.request_count + 1
  RETURNING request_count INTO v_new_count;

  IF p_max_rpm IS NOT NULL AND v_new_count > p_max_rpm THEN
    v_retry_after := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_window_start + interval '1 minute' - now()))));
    RETURN jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', v_retry_after
    );
  END IF;

  IF p_request_type = 'event' THEN
    INSERT INTO public.omnilink_events(
      tenant_id,
      integration_id,
      api_key_id,
      envelope_id,
      idempotency_key,
      source,
      type,
      subject,
      time,
      dataschema,
      data,
      entity
    ) VALUES (
      p_tenant_id,
      p_integration_id,
      p_api_key_id,
      v_envelope_id,
      p_idempotency_key,
      v_source,
      v_type,
      NULLIF(v_subject, ''),
      v_time,
      NULLIF(v_dataschema, ''),
      p_envelope->'data',
      p_envelope->'entity'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_record_id;

    IF v_record_id IS NULL THEN
      RETURN jsonb_build_object('status', 'duplicate');
    END IF;

    IF p_entity IS NOT NULL THEN
      INSERT INTO public.omnilink_entities(
        tenant_id,
        integration_id,
        entity_type,
        external_id,
        display_name,
        last_event_id
      ) VALUES (
        p_tenant_id,
        p_integration_id,
        p_entity->>'type',
        p_entity->>'external_id',
        p_entity->>'display_name',
        v_record_id
      )
      ON CONFLICT (integration_id, entity_type, external_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        last_event_id = EXCLUDED.last_event_id,
        updated_at = now();
    END IF;

    INSERT INTO public.audit_logs(actor_id, action_type, resource_type, resource_id, metadata)
    VALUES (NULL, 'omnilink.event.ingested', 'omnilink_event', v_record_id::text, jsonb_build_object('integration_id', p_integration_id));

    v_status := 'ingested';
  ELSE
    INSERT INTO public.omnilink_orchestration_requests(
      tenant_id,
      integration_id,
      api_key_id,
      request_type,
      envelope_id,
      idempotency_key,
      source,
      type,
      time,
      target,
      params,
      policy
    ) VALUES (
      p_tenant_id,
      p_integration_id,
      p_api_key_id,
      p_request_type,
      v_envelope_id,
      p_idempotency_key,
      v_source,
      v_type,
      v_time,
      p_envelope->'target',
      p_envelope->'params',
      p_envelope->'policy'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_record_id;

    IF v_record_id IS NULL THEN
      RETURN jsonb_build_object('status', 'duplicate');
    END IF;

    INSERT INTO public.audit_logs(actor_id, action_type, resource_type, resource_id, metadata)
    VALUES (NULL, 'omnilink.orchestration.queued', 'omnilink_orchestration', v_record_id::text, jsonb_build_object('integration_id', p_integration_id));

    v_status := public.omnilink_status_queued()::text;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'record_id', v_record_id
  );
END;
$$;
