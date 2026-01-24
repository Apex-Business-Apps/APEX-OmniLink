export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      automations: {
        Row: {
          action_type: string
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          created_at: string | null
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      health_checks: {
        Row: {
          created_at: string | null
          id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          name: string
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      omnilink_api_keys: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string | null
          revoked_at: string | null
          scopes: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string | null
          revoked_at?: string | null
          scopes?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string | null
          revoked_at?: string | null
          scopes?: Json
          tenant_id?: string
        }
        Relationships: []
      }
      omnilink_entities: {
        Row: {
          display_name: string | null
          entity_type: string
          external_id: string
          id: string
          integration_id: string
          last_event_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          display_name?: string | null
          entity_type: string
          external_id: string
          id?: string
          integration_id: string
          last_event_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          entity_type?: string
          external_id?: string
          id?: string
          integration_id?: string
          last_event_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      omnilink_events: {
        Row: {
          api_key_id: string
          data: Json
          dataschema: string | null
          entity: Json | null
          envelope_id: string
          id: string
          idempotency_key: string
          integration_id: string
          received_at: string
          source: string
          subject: string | null
          tenant_id: string
          time: string
          type: string
        }
        Insert: {
          api_key_id: string
          data: Json
          dataschema?: string | null
          entity?: Json | null
          envelope_id: string
          id?: string
          idempotency_key: string
          integration_id: string
          received_at?: string
          source: string
          subject?: string | null
          tenant_id: string
          time: string
          type: string
        }
        Update: {
          api_key_id?: string
          data?: Json
          dataschema?: string | null
          entity?: Json | null
          envelope_id?: string
          id?: string
          idempotency_key?: string
          integration_id?: string
          received_at?: string
          source?: string
          subject?: string | null
          tenant_id?: string
          time?: string
          type?: string
        }
        Relationships: []
      }
      omnilink_orchestration_requests: {
        Row: {
          api_key_id: string
          created_at: string
          envelope_id: string
          id: string
          idempotency_key: string
          integration_id: string
          params: Json | null
          policy: Json | null
          request_type: string
          source: string
          status: string
          target: Json | null
          tenant_id: string
          time: string
          type: string
          updated_at: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          envelope_id: string
          id?: string
          idempotency_key: string
          integration_id: string
          params?: Json | null
          policy?: Json | null
          request_type: string
          source: string
          status?: string
          target?: Json | null
          tenant_id: string
          time: string
          type: string
          updated_at?: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          envelope_id?: string
          id?: string
          idempotency_key?: string
          integration_id?: string
          params?: Json | null
          policy?: Json | null
          request_type?: string
          source?: string
          status?: string
          target?: Json | null
          tenant_id?: string
          time?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      omnilink_rate_limits: {
        Row: {
          api_key_id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key_id: string
          request_count?: number
          window_start: string
        }
        Update: {
          api_key_id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      omnilink_runs: {
        Row: {
          created_at: string
          error_message: string | null
          external_run_id: string | null
          finished_at: string | null
          id: string
          integration_id: string
          orchestration_request_id: string | null
          output: Json | null
          policy: Json | null
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_run_id?: string | null
          finished_at?: string | null
          id?: string
          integration_id: string
          orchestration_request_id?: string | null
          output?: Json | null
          policy?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_run_id?: string | null
          finished_at?: string | null
          id?: string
          integration_id?: string
          orchestration_request_id?: string | null
          output?: Json | null
          policy?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      omnilink_run_steps: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          output: Json | null
          run_id: string
          started_at: string | null
          status: string
          step_name: string
          finished_at: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          output?: Json | null
          run_id: string
          started_at?: string | null
          status?: string
          step_name: string
          finished_at?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          output?: Json | null
          run_id?: string
          started_at?: string | null
          status?: string
          step_name?: string
          finished_at?: string | null
        }
        Relationships: []
      }
      links: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          title: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          title: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          title?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      omnidash_incidents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          occurred_at: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["omnidash_incident_severity"]
          status: Database["public"]["Enums"]["omnidash_incident_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["omnidash_incident_severity"]
          status?: Database["public"]["Enums"]["omnidash_incident_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["omnidash_incident_severity"]
          status?: Database["public"]["Enums"]["omnidash_incident_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnidash_incidents_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      omnidash_kpi_daily: {
        Row: {
          cash_days_to_cash: number | null
          day: string
          flowbills_demos: number
          flowbills_paid_accounts: number
          id: string
          ops_sev1_incidents: number
          tradeline_active_pilots: number
          tradeline_churn_risks: number
          tradeline_paid_starts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_days_to_cash?: number | null
          day?: string
          flowbills_demos?: number
          flowbills_paid_accounts?: number
          id?: string
          ops_sev1_incidents?: number
          tradeline_active_pilots?: number
          tradeline_churn_risks?: number
          tradeline_paid_starts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_days_to_cash?: number | null
          day?: string
          flowbills_demos?: number
          flowbills_paid_accounts?: number
          id?: string
          ops_sev1_incidents?: number
          tradeline_active_pilots?: number
          tradeline_churn_risks?: number
          tradeline_paid_starts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnidash_kpi_daily_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      omnidash_pipeline_items: {
        Row: {
          account_name: string
          created_at: string
          expected_mrr: number | null
          id: string
          last_touch_at: string | null
          next_touch_at: string | null
          notes: string | null
          owner: string
          probability: number | null
          product: string
          stage: Database["public"]["Enums"]["omnidash_pipeline_stage"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          created_at?: string
          expected_mrr?: number | null
          id?: string
          last_touch_at?: string | null
          next_touch_at?: string | null
          notes?: string | null
          owner: string
          probability?: number | null
          product: string
          stage?: Database["public"]["Enums"]["omnidash_pipeline_stage"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          created_at?: string
          expected_mrr?: number | null
          id?: string
          last_touch_at?: string | null
          next_touch_at?: string | null
          notes?: string | null
          owner?: string
          probability?: number | null
          product?: string
          stage?: Database["public"]["Enums"]["omnidash_pipeline_stage"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnidash_pipeline_items_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      omnidash_settings: {
        Row: {
          anonymize_kpis: boolean
          demo_mode: boolean
          freeze_mode: boolean
          power_block_duration_minutes: number
          power_block_started_at: string | null
          show_connected_ecosystem: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          anonymize_kpis?: boolean
          demo_mode?: boolean
          freeze_mode?: boolean
          power_block_duration_minutes?: number
          power_block_started_at?: string | null
          show_connected_ecosystem?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          anonymize_kpis?: boolean
          demo_mode?: boolean
          freeze_mode?: boolean
          power_block_duration_minutes?: number
          power_block_started_at?: string | null
          show_connected_ecosystem?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnidash_settings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      omnidash_today_items: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          next_action: string | null
          order_index: number
          power_block_duration_minutes: number
          power_block_started_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          next_action?: string | null
          order_index?: number
          power_block_duration_minutes?: number
          power_block_started_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          next_action?: string | null
          order_index?: number
          power_block_duration_minutes?: number
          power_block_started_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnidash_today_items_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      device_registry: {
        Row: {
          device_fingerprint: string | null
          device_id: string
          first_seen_at: string
          last_seen_at: string
          status: string
          user_id: string
        }
        Insert: {
          device_fingerprint?: string | null
          device_id: string
          first_seen_at?: string
          last_seen_at?: string
          status?: string
          user_id: string
        }
        Update: {
          device_fingerprint?: string | null
          device_id?: string
          first_seen_at?: string
          last_seen_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          trial_start: string | null
          trial_end: string | null
          canceled_at: string | null
          cancel_at_period_end: boolean
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          trial_start?: string | null
          trial_end?: string | null
          canceled_at?: string | null
          cancel_at_period_end?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          trial_start?: string | null
          trial_end?: string | null
          canceled_at?: string | null
          cancel_at_period_end?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      wallet_identities: {
        Row: {
          id: string
          user_id: string
          wallet_address: string
          chain_id: number
          signature: string
          message: string
          verified_at: string
          last_used_at: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          wallet_address: string
          chain_id: number
          signature: string
          message: string
          verified_at?: string
          last_used_at?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          wallet_address?: string
          chain_id?: number
          signature?: string
          message?: string
          verified_at?: string
          last_used_at?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_identities_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_paid_user: {
        Args: { _user_id: string }
        Returns: boolean
      }
      get_user_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      omnilink_ingest: {
        Args: {
          p_api_key_id: string
          p_integration_id: string
          p_tenant_id: string
          p_request_type: string
          p_envelope: Json
          p_idempotency_key: string
          p_max_rpm: number
          p_entity?: Json | null
        }
        Returns: Json
      }
      omnilink_revoke_key: {
        Args: { p_key_id: string; p_user_id: string }
        Returns: void
      }
      omnilink_set_approval: {
        Args: { p_request_id: string; p_user_id: string; p_decision: string }
        Returns: void
      }
    }
    Enums: {
      app_role: "admin" | "user"
      omnidash_incident_severity: "sev1" | "sev2" | "sev3"
      omnidash_incident_status: "open" | "monitoring" | "resolved"
      subscription_tier: "free" | "starter" | "pro" | "enterprise"
      subscription_status: "active" | "trialing" | "past_due" | "canceled" | "expired" | "paused"
      omnidash_pipeline_stage:
        | "lead"
        | "contacted"
        | "meeting"
        | "proposal"
        | "negotiation"
        | "paid"
        | "live"
        | "lost"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      omnidash_incident_severity: ["sev1", "sev2", "sev3"],
      omnidash_incident_status: ["open", "monitoring", "resolved"],
      subscription_tier: ["free", "starter", "pro", "enterprise"],
      subscription_status: ["active", "trialing", "past_due", "canceled", "expired", "paused"],
      omnidash_pipeline_stage: [
        "lead",
        "contacted",
        "meeting",
        "proposal",
        "negotiation",
        "paid",
        "live",
        "lost",
      ],
    },
  },
} as const
