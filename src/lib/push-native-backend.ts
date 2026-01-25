/**
 * Register device token with Supabase backend
 */
async function registerTokenWithBackend(token: string, platform: string): Promise<void> {
    const { createClient } = await import('@/lib/supabase');
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User not authenticated');
    }

    // Get device info
    const { Device } = await import('@capacitor/device');
    const deviceInfo = await Device.getInfo();
    const deviceId = await Device.getId();

    // Upsert token
    const { error } = await supabase.rpc('upsert_push_device_token', {
        p_user_id: user.id,
        p_device_id: deviceId.identifier,
        p_platform: platform,
        p_token: token,
        p_app_version: deviceInfo.appVersion,
        p_os_version: deviceInfo.osVersion,
        p_device_model: deviceInfo.model,
    });

    if (error) {
        throw error;
    }

    console.log('[PushNative] Token registered with backend successfully');
}
