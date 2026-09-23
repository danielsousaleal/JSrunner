/**
 * Values that are safe to ship in the static browser bundle.
 * Server secrets are read only by server/src/env.ts.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  mercadoPagoPublicKey: process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ?? "",
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL || "https://js-runner-backend.onrender.com",
};
