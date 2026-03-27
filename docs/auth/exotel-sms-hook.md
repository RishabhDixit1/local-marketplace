# Exotel SMS OTP Hook

This app can relay Supabase Auth phone OTP requests to Exotel through Supabase's `Send SMS` Auth Hook.

## What this does

- Supabase generates the OTP.
- Supabase sends the signed hook payload to `/api/auth/send-sms`.
- The app verifies the hook signature.
- The app sends the OTP text to Exotel.

## Environment variables

Add these to `.env.local` and your deployment environment:

```bash
SUPABASE_SEND_SMS_HOOK_SECRET=v1,whsec_your_supabase_hook_secret

EXOTEL_API_BASE_URL=https://api.in.exotel.com
EXOTEL_ACCOUNT_SID=your_exotel_account_sid
EXOTEL_API_KEY=your_exotel_api_key
EXOTEL_API_TOKEN=your_exotel_api_token
EXOTEL_FROM=YourSenderIdOrVirtualNumber

EXOTEL_OTP_MESSAGE_TEMPLATE=Your ServiQ OTP is {{otp}}. Do not share it.
EXOTEL_SMS_TYPE=transactional
EXOTEL_PRIORITY=high

# Optional, but recommended for India delivery when required by your account
EXOTEL_DLT_ENTITY_ID=your_dlt_entity_id
EXOTEL_DLT_TEMPLATE_ID=your_dlt_template_id
```

The OTP template must include `{otp}` or `{{otp}}`.

## Supabase setup

1. Open your Supabase project.
2. Go to `Authentication > Hooks`.
3. Enable `Send SMS`.
4. Point the hook URL to `https://your-app-domain.com/api/auth/send-sms`.
5. Generate the hook secret in Supabase and copy it into `SUPABASE_SEND_SMS_HOOK_SECRET`.
6. Save the hook.

## Exotel setup

1. Create or open your Exotel OTP/SMS application.
2. Copy the account SID, API key, and API token into the env variables above.
3. Set the sender ID or virtual number in `EXOTEL_FROM`.
4. If you send OTPs to Indian numbers, make sure the sender and template are DLT-compliant.
5. If Exotel requires template registration, keep `EXOTEL_OTP_MESSAGE_TEMPLATE` identical to the approved template body.

## Local testing

1. Run the app locally.
2. Expose localhost through a public tunnel or deploy a preview URL.
3. Configure the Supabase hook to the public `/api/auth/send-sms` endpoint.
4. Request a phone OTP from the login screen.
5. Confirm the webhook route logs an Exotel SMS SID.

## Troubleshooting

- If the route returns `Invalid Supabase hook signature`, regenerate the hook secret and make sure the env value matches exactly.
- If Exotel rejects the request, check `EXOTEL_*` credentials and DLT template setup.
- If Supabase says the OTP was requested but the phone does not receive a message, check Exotel delivery logs and carrier restrictions.
