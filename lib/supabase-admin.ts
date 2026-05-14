import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role -avain puuttuu ympäristömuuttujista.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function requireUserFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    throw new Error("Kirjautuminen puuttuu.");
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Kirjautuminen ei ole voimassa.");
  }

  return { admin, user: data.user };
}
