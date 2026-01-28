/**
 * Biometric Authentication - WebAuthn API for Face ID / Touch ID
 * Supports: Fingerprint, Face Recognition, PIN, Pattern on compatible devices
 */

import { logAnalyticsEvent } from './monitoring';

export interface BiometricCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
  response: {
    clientDataJSON: ArrayBuffer;
    attestationObject: ArrayBuffer;
  };
}

export interface BiometricAuthOptions {
  rpName: string; // Relying Party name (e.g., "APEX OmniLink")
  rpId: string; // Domain (e.g., "omnihub.com")
  userName: string; // User's email or username
  userId: Uint8Array; // Unique user identifier
  challenge: Uint8Array; // Server-generated challenge
  timeout?: number; // milliseconds
  authenticatorAttachment?: 'platform' | 'cross-platform';
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

/**
 * Check if biometric authentication is supported
 */
export function isBiometricAuthSupported(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    (globalThis as any).PublicKeyCredential !== undefined &&
    typeof (globalThis as any).PublicKeyCredential === 'function'
  );
}

/**
 * Check if platform authenticator (Face ID/Touch ID) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricAuthSupported()) {
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const available = await (globalThis as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (error) {
    console.error('[Biometric] Failed to check platform authenticator:', error);
    return false;
  }
}

/**
 * Register biometric credential (enrollment)
 * Call this after user signs in with password to set up biometric login
 */
export async function registerBiometricCredential(
  options: BiometricAuthOptions
): Promise<BiometricCredential | null> {
  if (!isBiometricAuthSupported()) {
    throw new Error('Biometric authentication not supported');
  }

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: options.challenge,
    rp: {
      name: options.rpName,
      id: options.rpId,
    },
    user: {
      id: options.userId,
      name: options.userName,
      displayName: options.userName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: options.authenticatorAttachment || 'platform',
      userVerification: options.userVerification || 'required',
      requireResidentKey: false,
    },
    timeout: options.timeout || 60000,
    attestation: 'none',
  };

  try {
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return null;
    }

    void logAnalyticsEvent('biometric.registered', {
      type: credential.type,
      authenticatorAttachment: options.authenticatorAttachment,
      timestamp: new Date().toISOString(),
    });

    // The original code was already correct for rawId and type.
    // The user's requested change for this section was syntactically incorrect
    // and would have removed the rawId and type from the returned object.
    // Reverting to the original correct structure for this part.
    return {
      id: credential.id,
      rawId: credential.rawId,
      type: credential.type,
      response: {
        clientDataJSON: (credential.response as AuthenticatorAttestationResponse).clientDataJSON,
        attestationObject: (credential.response as AuthenticatorAttestationResponse)
          .attestationObject,
      },
    } as BiometricCredential;
  } catch (error) {
    console.error('[Biometric] Registration failed:', error);
    void logAnalyticsEvent('biometric.registration_failed', {
      error: error instanceof Error ? error.message : 'unknown',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Authenticate with biometric credential
 * Call this to sign in with Face ID/Touch ID
 */
export async function authenticateWithBiometric(
  challenge: Uint8Array,
  allowedCredentialIds: string[],
  rpId: string,
  timeout?: number
): Promise<{
  credentialId: string;
  clientDataJSON: ArrayBuffer;
  authenticatorData: ArrayBuffer;
  signature: ArrayBuffer;
  userHandle: ArrayBuffer | null;
} | null> {
  if (!isBiometricAuthSupported()) {
    throw new Error('Biometric authentication not supported');
  }

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: allowedCredentialIds.map((id) => ({
      id: base64ToArrayBuffer(id),
      type: 'public-key',
      transports: ['internal'], // For platform authenticators
    })),
    timeout: timeout || 60000,
    rpId,
    userVerification: 'required',
  };

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return null;
    }

    const response = assertion.response as AuthenticatorAssertionResponse;

    void logAnalyticsEvent('biometric.authenticated', {
      credentialId: assertion.id,
      timestamp: new Date().toISOString(),
    });

    return {
      credentialId: assertion.id,
      clientDataJSON: response.clientDataJSON,
      authenticatorData: response.authenticatorData,
      signature: response.signature,
      userHandle: response.userHandle,
    };
  } catch (error) {
    console.error('[Biometric] Authentication failed:', error);
    void logAnalyticsEvent('biometric.authentication_failed', {
      error: error instanceof Error ? error.message : 'unknown',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Remove biometric credential (de-enrollment)
 */
export async function removeBiometricCredential(credentialId: string): Promise<void> {
  // Note: WebAuthn API doesn't provide credential deletion
  // This should be handled server-side by removing the credential from database
  void logAnalyticsEvent('biometric.removed', {
    credentialId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get user's registered biometric credentials
 * Note: This requires server-side storage as browser doesn't expose credential list
 */
export async function getBiometricCredentials(
  userId: string,
  apiUrl: string
): Promise<Array<{ id: string; createdAt: string; lastUsed: string }>> {
  const response = await fetch(`${apiUrl}/auth/biometric/credentials?userId=${userId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch biometric credentials');
  }

  return response.json();
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64.replaceAll(/-/g, '+').replaceAll(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i) || 0;
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCodePoint(bytes[i]);
  }
  return window.btoa(binary).replaceAll(/\+/g, '-').replaceAll(/\//g, '_').replaceAll(/=/g, '');
}

/**
 * Generate random challenge for authentication
 * Should be called server-side in production
 */
export function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  globalThis.crypto.getRandomValues(challenge);
  return challenge;
}

/**
 * Get biometric authenticator info
 */
export async function getBiometricAuthenticatorInfo(): Promise<{
  available: boolean;
  type: 'face' | 'fingerprint' | 'pin' | 'unknown';
  platform: 'ios' | 'android' | 'windows' | 'mac' | 'unknown';
}> {
  const available = await isPlatformAuthenticatorAvailable();

  if (!available) {
    return {
      available: false,
      type: 'unknown',
      platform: 'unknown',
    };
  }

  // Detect platform
  const ua = navigator.userAgent.toLowerCase();
  let platform: 'ios' | 'android' | 'windows' | 'mac' | 'unknown' = 'unknown';
  let type: 'face' | 'fingerprint' | 'pin' | 'unknown' = 'unknown';

  if (/iphone|ipad/.test(ua)) {
    platform = 'ios';
    // iOS devices with Face ID: iPhone X and later
    type = /iPhone1\d,/.test(ua) ? 'face' : 'fingerprint';
  } else if (/android/.test(ua)) {
    platform = 'android';
    type = 'fingerprint'; // Most Android devices use fingerprint
  } else if (/windows/.test(ua)) {
    platform = 'windows';
    type = 'fingerprint'; // Windows Hello
  } else if (/mac/.test(ua)) {
    platform = 'mac';
    type = 'fingerprint'; // Touch ID
  }

  return { available, type, platform };
}

/**
 * Initialize biometric authentication system
 */
export async function initializeBiometricAuth(): Promise<void> {
  const info = await getBiometricAuthenticatorInfo();

  if (!info.available) {
    console.log('[Biometric] Authenticator not available');
    return;
  }

  console.log('[Biometric] Authenticator available:', info);

  void logAnalyticsEvent('biometric.initialized', {
    ...info,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Higher-level API: Setup biometric login for user
 */
export async function setupBiometricLogin(
  userId: string,
  userEmail: string,
  apiUrl: string
): Promise<boolean> {
  try {
    // 1. Check support
    if (!isBiometricAuthSupported()) {
      throw new Error('Biometric authentication not supported');
    }

    const available = await isPlatformAuthenticatorAvailable();
    if (!available) {
      throw new Error('Platform authenticator not available');
    }

    // 2. Get challenge from server
    const challengeResponse = await fetch(`${apiUrl}/auth/biometric/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!challengeResponse.ok) {
      throw new Error('Failed to get challenge from server');
    }

    const { challenge } = await challengeResponse.json();

    // 3. Register credential
    const credential = await registerBiometricCredential({
      rpName: 'APEX OmniLink',
      rpId: new URL(apiUrl).hostname,
      userName: userEmail,
      userId: new TextEncoder().encode(userId),
      challenge: base64ToArrayBuffer(challenge),
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    });

    if (!credential) {
      return false;
    }

    // 4. Send credential to server for storage
    const registerResponse = await fetch(`${apiUrl}/auth/biometric/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        credentialId: credential.id,
        credentialPublicKey: arrayBufferToBase64(credential.response.attestationObject),
        timestamp: new Date().toISOString(),
      }),
    });

    if (!registerResponse.ok) {
      throw new Error('Failed to register credential on server');
    }

    console.log('[Biometric] Setup complete');
    return true;
  } catch (error) {
    console.error('[Biometric] Setup failed:', error);
    return false;
  }
}

/**
 * Higher-level API: Login with biometric
 */
export async function loginWithBiometric(
  userEmail: string,
  apiUrl: string
): Promise<{ success: boolean; sessionToken?: string }> {
  try {
    // 1. Get challenge and allowed credentials from server
    const challengeResponse = await fetch(`${apiUrl}/auth/biometric/login/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail }),
    });

    if (!challengeResponse.ok) {
      throw new Error('Failed to get challenge from server');
    }

    const { challenge, allowedCredentials } = await challengeResponse.json();

    // 2. Authenticate with biometric
    const assertion = await authenticateWithBiometric(
      base64ToArrayBuffer(challenge),
      allowedCredentials,
      new URL(apiUrl).hostname
    );

    if (!assertion) {
      return { success: false };
    }

    // 3. Verify assertion on server
    const verifyResponse = await fetch(`${apiUrl}/auth/biometric/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: assertion.credentialId,
        clientDataJSON: arrayBufferToBase64(assertion.clientDataJSON),
        authenticatorData: arrayBufferToBase64(assertion.authenticatorData),
        signature: arrayBufferToBase64(assertion.signature),
        userHandle: assertion.userHandle ? arrayBufferToBase64(assertion.userHandle) : null,
      }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Biometric verification failed');
    }

    const { sessionToken } = await verifyResponse.json();

    return { success: true, sessionToken };
  } catch (error) {
    console.error('[Biometric] Login failed:', error);
    return { success: false };
  }
}
