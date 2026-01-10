import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SkillDefinition, SkillMatch } from './types.ts';

export class SkillRegistry {
  private supabase: SupabaseClient;
  private aiSession: unknown;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.initializeAISession();
  }

  private async initializeAISession() {
    try {
      // Initialize Supabase AI session for gte-small embeddings
      this.aiSession = await this.supabase.ai.createSession({
        model: 'gte-small'
      });
    } catch (error) {
      console.error('Failed to initialize AI session:', error);
      throw new Error('Supabase AI session unavailable. Ensure AI add-on is enabled and compute credits are available.');
    }
  }

  /**
   * Register a new skill in the registry
   */
  async registerSkill(skill: SkillDefinition): Promise<void> {
    // Sanitize inputs
    const sanitizedName = skill.name.trim();
    const sanitizedDescription = skill.description.trim();

    if (!sanitizedName || !sanitizedDescription) {
      throw new Error('Skill name and description are required');
    }

    // Generate embedding for the skill description
    let embedding: number[];
    try {
      const response = await this.aiSession.run({
        input: `${sanitizedName}: ${sanitizedDescription}`,
        mean_pool: true,
        normalize: true
      });
      embedding = response.embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error('Embedding generation failed. Check AI session and credits.');
    }

    // Convert to pgvector format
    const embeddingVector = `[${embedding.join(',')}]`;

    // Upsert skill into database
    const { error } = await this.supabase
      .from('agent_skills')
      .upsert({
        name: sanitizedName,
        description: sanitizedDescription,
        tool_definition: skill.parameters,
        embedding: embeddingVector,
        metadata: skill.metadata || {}
      }, {
        onConflict: 'name'
      });

    if (error) {
      console.error('Failed to register skill:', error);
      throw new Error(`Skill registration failed: ${error.message}`);
    }
  }

  /**
   * Retrieve relevant skills based on a query
   */
  async retrieveSkills(query: string, limit: number = 5, threshold: number = 0.1): Promise<SkillDefinition[]> {
    const sanitizedQuery = query.trim();

    if (!sanitizedQuery) {
      return [];
    }

    // Generate embedding for the query
    let queryEmbedding: number[];
    try {
      const response = await this.aiSession.run({
        input: sanitizedQuery,
        mean_pool: true,
        normalize: true
      });
      queryEmbedding = response.embedding;
    } catch (error) {
      console.error('Failed to generate query embedding:', error);
      throw new Error('Query embedding generation failed. Check AI session and credits.');
    }

    // Convert to pgvector format
    const embeddingVector = `[${queryEmbedding.join(',')}]`;

    // Call the hybrid search RPC
    const { data: matches, error } = await this.supabase
      .rpc('match_skills', {
        query_embedding: embeddingVector,
        query_text: sanitizedQuery,
        match_threshold: threshold,
        match_count: limit
      });

    if (error) {
      console.error('Failed to retrieve skills:', error);
      throw new Error(`Skill retrieval failed: ${error.message}`);
    }

    // Convert database results to SkillDefinition format
    return (matches || []).map((match: SkillMatch) => ({
      name: match.name,
      description: match.description,
      parameters: match.tool_definition,
      metadata: match.metadata
    }));
  }

  /**
   * Get all registered skills (for debugging/admin purposes)
   */
  async getAllSkills(): Promise<SkillDefinition[]> {
    const { data, error } = await this.supabase
      .from('agent_skills')
      .select('name, description, tool_definition, metadata')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get all skills:', error);
      throw new Error(`Failed to retrieve skills: ${error.message}`);
    }

    return (data || []).map(row => ({
      name: row.name,
      description: row.description,
      parameters: row.tool_definition,
      metadata: row.metadata
    }));
  }

  /**
   * Remove a skill from the registry
   */
  async removeSkill(skillName: string): Promise<void> {
    const { error } = await this.supabase
      .from('agent_skills')
      .delete()
      .eq('name', skillName.trim());

    if (error) {
      console.error('Failed to remove skill:', error);
      throw new Error(`Skill removal failed: ${error.message}`);
    }
  }
}