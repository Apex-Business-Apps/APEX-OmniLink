import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-maestro-idempotency-key',
};

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // 1. Rate Limiting (Basic)
        // In production, use Redis or Supabase generic rate limiting

        // 2. Parse Payload
        const { encrypted_blob, signature, operation, timestamp } = await req.json();
        const idempotencyKey = req.headers.get('x-maestro-idempotency-key');

        if (!idempotencyKey) {
            throw new Error('Missing Idempotency Key');
        }

        if (!encrypted_blob || !signature) {
            throw new Error('Invalid Maestro Payload');
        }

        // 3. Idempotency Check
        // Check if this key has already been processed successfully
        const { data: existingReceipt } = await supabaseClient
            .from('maestro_audit_logs')
            .select('id')
            .eq('idempotency_key', idempotencyKey)
            .single();

        if (existingReceipt) {
            return new Response(JSON.stringify({
                success: true,
                receipt: idempotencyKey,
                status: 'cached'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        // 4. Store Encrypted Blob (Append-Only)
        // We treat the server as a "dumb store" for the client's encrypted state.
        const { error: storageError } = await supabaseClient
            .from('maestro_sync_store')
            .insert({
                user_id: (await supabaseClient.auth.getUser()).data.user?.id,
                idempotency_key: idempotencyKey,
                encrypted_data: encrypted_blob,
                signature: signature, // For client-side verification later
                operation: operation || 'sync',
                client_timestamp: timestamp
            });

        if (storageError) {
            console.error('Storage Error:', storageError);
            throw new Error('Failed to persist sync state');
        }

        // 5. Audit Log (Receipt)
        await supabaseClient
            .from('maestro_audit_logs')
            .insert({
                idempotency_key: idempotencyKey,
                action: operation || 'sync',
                status: 'success',
                ip: req.headers.get('x-forwarded-for') ?? 'unknown',
                user_agent: req.headers.get('user-agent') ?? 'unknown'
            });

        return new Response(JSON.stringify({
            success: true,
            receipt: idempotencyKey,
            status: 'processed'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('[MAESTRO SYNC ERROR]', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
