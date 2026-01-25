# Native Push Notifications Setup Guide

## Overview
This implementation uses **native APNS (iOS) and FCM HTTP v1 API (Android)** without Firebase SDK.

---

## Prerequisites

### For iOS (APNS)
1. **Apple Developer Account** (required)
2. **APNS Authentication Key (.p8 file)**:
   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
   - Create a new key with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` file (you can only download it once!)
   - Note the Key ID (e.g., `ABC123DEFG`)
   - Note your Team ID (found in membership details)

### For Android (FCM)
1. **Google Cloud Project** (free)
2. **Service Account with FCM permissions**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "Firebase Cloud Messaging API"
   - Create a service account with "Firebase Cloud Messaging API Admin" role
   - Generate and download JSON key file

---

## Step 1: Configure Environment Variables

Add these to your Supabase project secrets:

```bash
# iOS APNS Configuration
APNS_KEY_ID=ABC123DEFG                    # From .p8 file
APNS_TEAM_ID=DEF123GHIJ                   # Your Apple Team ID
APNS_BUNDLE_ID=com.apexbusiness.omnilink  # Your app bundle ID
APNS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...  # Content of .p8 file
APNS_ENVIRONMENT=development              # 'development' or 'production'

# Android FCM Configuration
FCM_PROJECT_ID=your-project-id            # From service account JSON
FCM_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...  # From service account JSON
FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**To set in Supabase:**
```bash
# Using Supabase CLI
supabase secrets set APNS_KEY_ID=ABC123DEFG
supabase secrets set APNS_TEAM_ID=DEF123GHIJ
# ... repeat for all variables
```

---

## Step 2: Deploy Database Migration

```bash
supabase db push
```

This creates the `push_device_tokens` table.

---

## Step 3: Deploy Edge Function

```bash
supabase functions deploy send-push-notification
```

---

## Step 4: Complete JWT Implementation

The Edge Function needs JWT libraries for APNS and FCM authentication. Add to `supabase/functions/send-push-notification/index.ts`:

```typescript
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { importPKCS8 } from 'https://deno.land/x/jose@v4.14.4/key/import.ts';

async function generateAPNSJWT(): Promise<string> {
  const privateKey = await importPKCS8(APNS_PRIVATE_KEY!, 'ES256');
  
  const jwt = await create(
    { alg: 'ES256', kid: APNS_KEY_ID },
    {
      iss: APNS_TEAM_ID,
      iat: getNumericDate(new Date()),
    },
    privateKey
  );
  
  return jwt;
}

async function getFCMAccessToken(): Promise<string> {
  const privateKey = await importPKCS8(FCM_PRIVATE_KEY!, 'RS256');
  
  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: FCM_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: getNumericDate(new Date()),
      exp: getNumericDate(new Date(Date.now() + 3600 * 1000)),
    },
    privateKey
  );
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  const data = await response.json();
  return data.access_token;
}
```

---

## Step 5: Test Push Notifications

### Test via Edge Function:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid-here",
    "title": "Test Notification",
    "body": "This is a test from native APNS/FCM",
    "badge": 1
  }'
```

### Test from App:

```typescript
import { initializeNativePush } from '@/lib/push-native';

// Initialize on app start
await initializeNativePush({
  onTokenReceived: async (token) => {
    console.log('Device token:', token);
    // Token is automatically registered with backend
  },
  onNotificationReceived: (notification) => {
    console.log('Notification received:', notification);
  },
});
```

---

## iOS-Specific Setup

1. **Add Push Notification Capability**:
   - Open `ios/App/App.xcodeproj` in Xcode
   - Select your app target
   - Go to "Signing & Capabilities"
   - Click "+ Capability"
   - Add "Push Notifications"

2. **Update Info.plist** (if needed):
   ```xml
   <key>UIBackgroundModes</key>
   <array>
     <string>remote-notification</string>
   </array>
   ```

---

## Android-Specific Setup

1. **No additional setup required** - FCM HTTP v1 API works without Firebase SDK!

2. **Optional: Add notification icon**:
   - Place icon in `android/app/src/main/res/drawable/`
   - Update `AndroidManifest.xml`:
     ```xml
     <meta-data
       android:name="com.google.firebase.messaging.default_notification_icon"
       android:resource="@drawable/ic_notification" />
     ```

---

## Sending Notifications from Backend

```typescript
// From any Supabase Edge Function or server
const { data, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    user_id: 'user-uuid',
    title: 'New Message',
    body: 'You have a new message from John',
    data: {
      type: 'message',
      messageId: '123',
    },
    badge: 5,
  },
});
```

---

## Troubleshooting

### iOS Issues:
- **"Invalid token"**: Ensure you're using the correct APNS environment (sandbox vs production)
- **"Bad certificate"**: Verify APNS_PRIVATE_KEY is correctly formatted with `\n` for newlines
- **No notifications**: Check device has push permissions enabled

### Android Issues:
- **"Authentication error"**: Verify FCM service account has correct permissions
- **"Invalid registration token"**: Token may have expired, app will receive new token on next launch

---

## Cost

**100% FREE** - No Firebase costs, no third-party service fees:
- APNS: Free (Apple Developer account required)
- FCM HTTP v1 API: Free (Google Cloud project required)
- Supabase Edge Functions: Free tier includes 500K requests/month

---

## Security Notes

1. **Never commit credentials** - Use Supabase secrets only
2. **Rotate keys regularly** - APNS keys and service accounts should be rotated annually
3. **Validate tokens** - Edge Function should verify user owns the device token before sending
4. **Rate limiting** - Consider adding rate limits to prevent abuse
