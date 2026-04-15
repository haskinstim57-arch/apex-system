export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  vapiApiKey: process.env.VAPI_API_KEY ?? "",
  vapiAgentId: process.env.VAPI_AGENT_ID ?? "",
  vapiAgentIdRealtor: process.env.VAPI_AGENT_ID_REALTOR ?? "",
  vapiAgentIdInstagram: process.env.VAPI_AGENT_ID_INSTAGRAM ?? "",
  facebookAppId: process.env.FACEBOOK_APP_ID ?? "",
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? "",
  facebookWebhookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID ?? "",
  microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL ?? "",
  sendgridFromName: process.env.SENDGRID_FROM_NAME ?? "",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  squareAccessToken: process.env.SQUARE_ACCESS_TOKEN ?? "",
  squareLocationId: process.env.SQUARE_LOCATION_ID ?? "",
  squareWebhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "",
  squareApplicationId: process.env.VITE_SQUARE_APPLICATION_ID ?? "",
  squareEnvironment: process.env.VITE_SQUARE_ENVIRONMENT ?? "production",
};

/**
 * Check if specific OAuth integrations have their credentials configured.
 * Returns a status object for each integration.
 */
export function getOAuthConfigStatus() {
  return {
    microsoft: {
      configured: !!(ENV.microsoftClientId && ENV.microsoftClientSecret),
      missing: [
        ...(!ENV.microsoftClientId ? ["MICROSOFT_CLIENT_ID"] : []),
        ...(!ENV.microsoftClientSecret ? ["MICROSOFT_CLIENT_SECRET"] : []),
      ],
    },
    google: {
      configured: !!(ENV.googleClientId && ENV.googleClientSecret),
      missing: [
        ...(!ENV.googleClientId ? ["GOOGLE_CLIENT_ID"] : []),
        ...(!ENV.googleClientSecret ? ["GOOGLE_CLIENT_SECRET"] : []),
      ],
    },
    facebook: {
      configured: !!(ENV.facebookAppId && ENV.facebookAppSecret),
      missing: [
        ...(!ENV.facebookAppId ? ["FACEBOOK_APP_ID"] : []),
        ...(!ENV.facebookAppSecret ? ["FACEBOOK_APP_SECRET"] : []),
      ],
    },
    twilio: {
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      missing: [
        ...(!process.env.TWILIO_ACCOUNT_SID ? ["TWILIO_ACCOUNT_SID"] : []),
        ...(!process.env.TWILIO_AUTH_TOKEN ? ["TWILIO_AUTH_TOKEN"] : []),
      ],
    },
    square: {
      configured: !!(ENV.squareAccessToken && ENV.squareLocationId && ENV.squareApplicationId),
      missing: [
        ...(!ENV.squareAccessToken ? ["SQUARE_ACCESS_TOKEN"] : []),
        ...(!ENV.squareLocationId ? ["SQUARE_LOCATION_ID"] : []),
        ...(!ENV.squareApplicationId ? ["VITE_SQUARE_APPLICATION_ID"] : []),
      ],
    },
    gemini: {
      configured: !!ENV.geminiApiKey,
      missing: !ENV.geminiApiKey ? ["GEMINI_API_KEY"] : [],
    },
  };
}
