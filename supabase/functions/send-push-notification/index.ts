// Supabase Edge Function: Send Push Notification
// Dispatches push notifications to iOS (APNS) and Android (FCM) devices
// No Firebase SDK required - uses native HTTP APIs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// APNS Configuration (iOS)
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID'); // e.g., "ABC123DEFG"
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID'); // e.g., "DEF123GHIJ"
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || 'com.apexbusiness.omnilink';
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY'); // .p8 file content
const APNS_ENVIRONMENT = Deno.env.get('APNS_ENVIRONMENT') || 'development'; // 'development' or 'production'

// FCM Configuration (Android)
const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID');
const FCM_PRIVATE_KEY = Deno.env.get('FCM_PRIVATE_KEY');
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL');

interface PushNotificationPayload {
    user_id?: string;
    device_tokens?: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
    badge?: number;
    sound?: string;
}

serve(async (req) => {
    try {
        // Verify authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Parse request body
        const payload: PushNotificationPayload = await req.json();
        const { user_id, device_tokens, title, body, data, badge, sound } = payload;

        // Get device tokens from database if user_id provided
        let tokens: Array<{ token: string; platform: string }> = [];

        if (user_id) {
            const { data: deviceData, error } = await supabase
                .from('push_device_tokens')
                .select('token, platform')
                .eq('user_id', user_id)
                .eq('is_active', true);

            if (error) throw error;
            tokens = deviceData || [];
        } else if (device_tokens) {
            // Use provided tokens (need to determine platform from token format)
            tokens = device_tokens.map(token => ({
                token,
                platform: token.length > 100 ? 'ios' : 'android', // Heuristic
            }));
        }

        if (tokens.length === 0) {
            return new Response(JSON.stringify({ error: 'No device tokens found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Send notifications
        const results = await Promise.allSettled(
            tokens.map(async ({ token, platform }) => {
                if (platform === 'ios') {
                    return await sendAPNS(token, { title, body, data, badge, sound });
                } else {
                    return await sendFCM(token, { title, body, data });
                }
            })
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return new Response(
            JSON.stringify({
                success: true,
                sent: succeeded,
                failed,
                total: tokens.length,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Push notification error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
});

/**
 * Send push notification via APNS (iOS)
 * Uses HTTP/2 API - no Firebase required
 */
async function sendAPNS(
    deviceToken: string,
    payload: { title: string; body: string; data?: Record<string, string>; badge?: number; sound?: string }
): Promise<void> {
    if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
        throw new Error('APNS credentials not configured');
    }

    // Generate JWT for APNS authentication
    const jwt = await generateAPNSJWT();

    const apnsPayload = {
        aps: {
            alert: {
                title: payload.title,
                body: payload.body,
            },
            badge: payload.badge,
            sound: payload.sound || 'default',
        },
        ...payload.data,
    };

    const apnsUrl = APNS_ENVIRONMENT === 'production'
        ? `https://api.push.apple.com/3/device/${deviceToken}`
        : `https://api.sandbox.push.apple.com/3/device/${deviceToken}`;

    const response = await fetch(apnsUrl, {
        method: 'POST',
        headers: {
            'authorization': `bearer ${jwt}`,
            'apns-topic': APNS_BUNDLE_ID,
            'apns-push-type': 'alert',
            'apns-priority': '10',
        },
        body: JSON.stringify(apnsPayload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`APNS error: ${response.status} - ${errorText}`);
    }
}

/**
 * Send push notification via FCM HTTP v1 API (Android)
 * No Firebase SDK required - uses Google Cloud service account
 */
async function sendFCM(
    deviceToken: string,
    payload: { title: string; body: string; data?: Record<string, string> }
): Promise<void> {
    if (!FCM_PROJECT_ID || !FCM_PRIVATE_KEY || !FCM_CLIENT_EMAIL) {
        throw new Error('FCM credentials not configured');
    }

    // Get OAuth2 access token
    const accessToken = await getFCMAccessToken();

    const fcmPayload = {
        message: {
            token: deviceToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data,
            android: {
                priority: 'high',
            },
        },
    };

    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fcmPayload),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FCM error: ${response.status} - ${errorText}`);
    }
}

/**
 * Generate JWT for APNS authentication
 */
async function generateAPNSJWT(): Promise<string> {
    // TODO: Implement JWT generation using APNS private key
    // This requires importing a JWT library or implementing ES256 signing
    // For now, returning placeholder
    throw new Error('APNS JWT generation not yet implemented - requires ES256 signing');
}

/**
 * Get OAuth2 access token for FCM
 */
async function getFCMAccessToken(): Promise<string> {
    // TODO: Implement OAuth2 token generation using service account
    // This requires importing a JWT library or implementing RS256 signing
    // For now, returning placeholder
    throw new Error('FCM OAuth2 token generation not yet implemented - requires RS256 signing');
}
