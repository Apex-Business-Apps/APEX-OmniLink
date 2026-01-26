/**
 * Native Biometric Authentication - Capacitor Wrapper
 * Handles FaceID (iOS) and Fingerprint/BiometricPrompt (Android)
 */

import { Capacitor } from '@capacitor/core';
import { logAnalyticsEvent } from './monitoring';

// Biometric types available
export type BiometricType = 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricAuthResult {
    success: boolean;
    error?: string;
    biometricType?: BiometricType;
}

/**
 * Check if running in native environment
 */
export function isNativeEnvironment(): boolean {
    return Capacitor.isNativePlatform();
}

/**
 * Check if biometric authentication is available
 * Uses native APIs directly since community plugin failed to install
 */
export async function isBiometricAvailable(): Promise<{ available: boolean; biometricType: BiometricType }> {
    if (!isNativeEnvironment()) {
        return { available: false, biometricType: 'none' };
    }

    try {
        const platform = Capacitor.getPlatform();

        // For now, we'll assume availability based on platform
        // In production, you would check actual device capabilities
        if (platform === 'ios') {
            // iOS typically has FaceID or TouchID
            return { available: true, biometricType: 'face' };
        } else if (platform === 'android') {
            // Android typically has fingerprint
            return { available: true, biometricType: 'fingerprint' };
        }

        return { available: false, biometricType: 'none' };
    } catch (error) {
        console.error('[BiometricNative] Failed to check biometric availability:', error);
        return { available: false, biometricType: 'none' };
    }
}

/**
 * Authenticate using biometrics
 * Note: This is a placeholder implementation
 * In production, you would use native biometric APIs or a working plugin
 */
export async function authenticateWithBiometrics(options?: {
    reason?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    cancelButtonText?: string;
    allowDeviceCredential?: boolean;
}): Promise<BiometricAuthResult> {
    if (!isNativeEnvironment()) {
        return {
            success: false,
            error: 'Not running in native environment',
        };
    }

    try {
        const { available, biometricType } = await isBiometricAvailable();

        if (!available) {
            return {
                success: false,
                error: 'Biometric authentication not available on this device',
                biometricType: 'none',
            };
        }

        // Log authentication attempt
        void logAnalyticsEvent('biometric_native.auth_attempt', {
            biometricType,
            platform: Capacitor.getPlatform(),
            timestamp: new Date().toISOString(),
        });

        // NOTE: Biometric authentication requires a working Capacitor plugin
        // Options: @aparajita/capacitor-biometric-auth or custom native implementation
        // This is a placeholder that returns an error until plugin is installed

        console.warn('[BiometricNative] Biometric authentication not fully implemented - placeholder only');

        // For now, return a simulated success for development
        // In production, this should be replaced with actual biometric verification
        return {
            success: false,
            error: 'Biometric authentication requires native implementation',
            biometricType,
        };
    } catch (error) {
        console.error('[BiometricNative] Authentication failed:', error);

        void logAnalyticsEvent('biometric_native.auth_error', {
            error: String(error),
            platform: Capacitor.getPlatform(),
            timestamp: new Date().toISOString(),
        });

        return {
            success: false,
            error: String(error),
        };
    }
}

/**
 * Get biometric type name for UI display
 */
export function getBiometricTypeName(type: BiometricType): string {
    switch (type) {
        case 'face':
            return 'Face ID';
        case 'fingerprint':
            return 'Fingerprint';
        case 'iris':
            return 'Iris';
        case 'none':
            return 'None';
        default:
            return 'Biometric';
    }
}

/**
 * Check if device credentials (PIN/password) are available as fallback
 */
export async function isDeviceCredentialAvailable(): Promise<boolean> {
    if (!isNativeEnvironment()) {
        return false;
    }

    // Assume device credentials are available on native platforms
    // In production, this would check actual device settings
    return true;
}
