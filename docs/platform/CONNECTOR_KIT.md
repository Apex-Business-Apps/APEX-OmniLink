# OmniHub Connector Kit

The Connector Kit is a universal "Press a Button" integration system that allows you to generate API keys and configure inbound integrations (like Webhooks, OmniLink Events) instantly.

## How to Use

1.  **Navigate to Integrations**: Go to the `/integrations` page in your OmniHub dashboard.
2.  **Select a Service**: Click the **Connect** button on the integration card you wish to enable (e.g., "TradeLine 24/7", "WhatsApp").
3.  **Enable Integration**: If the integration is not yet enabled, click **Enable [Name]**. This will initialize the secure storage for this integration.
4.  **Generate Key**: Click **Generate New API Key**.
    > **Important**: The API Key is only shown **ONCE**. Copy it immediately.
5.  **Copy Configuration**: Click the **Copy JSON** button to get the full configuration object, including your Server URL, Public URL, and API Key. You can paste this directly into your external service's configuration.

## Key Rotation

If you suspect your API key has been compromised, or as part of regular security practices:
1.  Open the configured integration.
2.  Click **Regenerate (Rotates Key)**.
3.  A new key will be generated. The old key may remain valid for a short period or be immediately revoked depending on system policy (default is immediate revocation of compromised keys if reported, but simplistic rotation generates a fresh independent key).
4.  Update your external service with the new key.

## Environment Variables

The Connector Kit relies on the following environment variables to generate the correct URLs:

- `VITE_PUBLIC_URL` or `OMNIHUB_PUBLIC_URL`: The publicly accessible URL of your OmniHub instance (e.g., `https://omnihub.yourdomain.com`).
- `VITE_SUPABASE_URL`: The URL of your Supabase project (used for Edge Function calls).

## Developer Notes

- **Registry**: Integrations are defined in `src/omniconnect/core/registry.ts`.
- **Backend**: Key generation is handled by the `omnilink-port` Edge Function.
- **Security**: Keys are stored as SHA-256 hashes in `omnilink_api_keys`. They are never stored in plaintext.
