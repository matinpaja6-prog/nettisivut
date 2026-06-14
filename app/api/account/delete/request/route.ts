import { createHash, randomInt } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY;

function getAuthClient() {
  if (!supabaseUrl || !anonKey) return null;

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [type, token] = header.split(" ");

  if (type.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendDeletionEmail(input: {
  to: string;
  code: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return { sent: false, error: "RESEND_API_KEY puuttuu" };
  }

  const from =
    process.env.ACCOUNT_EMAIL_FROM ??
    process.env.ALERT_FROM_EMAIL ??
    "Maskines <onboarding@resend.dev>";

  const code = escapeHtml(input.code);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Vahvista tilin poistaminen",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#f8fafc;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:#0f766e;color:#fff;padding:22px 26px;">
              <h1 style="font-size:20px;line-height:1.25;margin:0;">Vahvista tilin poistaminen</h1>
            </div>
            <div style="padding:26px;">
              <p style="font-size:15px;color:#334155;line-height:1.55;margin:0 0 16px;">
                Käytä tätä koodia vain, jos olet itse poistamassa tiliäsi. Koodi on voimassa 15 minuuttia.
              </p>
              <div style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0f172a;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:14px;padding:18px 22px;text-align:center;">
                ${code}
              </div>
              <p style="font-size:13px;color:#64748b;line-height:1.55;margin:18px 0 0;">
                Jos et pyytänyt tilin poistoa, voit jättää tämän viestin huomiotta.
              </p>
            </div>
          </div>
        </div>
      `
    })
  });

  if (!response.ok) {
    return { sent: false, error: await response.text() };
  }

  return { sent: true };
}

export async function POST(request: Request) {
  const auth = getAuthClient();
  const admin = getAdminClient();

  if (!auth || !admin) {
    const missing = [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : "",
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY tai NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : "",
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""
    ].filter(Boolean);

    return NextResponse.json(
      { error: `Supabase-palvelinasetukset puuttuvat: ${missing.join(", ")}.` },
      { status: 500 }
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Kirjaudu sisään ennen tilin poistamista." },
      { status: 401 }
    );
  }

  const { data: userData, error: userError } =
    await auth.auth.getUser(token);

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "Istuntoa ei voitu vahvistaa." },
      { status: 401 }
    );
  }

  const user = userData.user;
  const email = user.email;

  if (!email) {
    return NextResponse.json(
      { error: "Tilillä ei ole sähköpostiosoitetta." },
      { status: 400 }
    );
  }

  const code =
    String(randomInt(100000, 1000000));

  const { error: insertError } =
    await admin
      .from("account_deletion_requests")
      .insert({
        user_id: user.id,
        email,
        code_hash: hashCode(code),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });

  if (insertError) {
    return NextResponse.json(
      {
        error:
          insertError.message.includes("account_deletion_requests")
            ? "Aja ensin Supabasessa account-deletion.sql."
            : insertError.message
      },
      { status: 500 }
    );
  }

  const emailResult =
    await sendDeletionEmail({ to: email, code });

  if (!emailResult.sent) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      error: emailResult.error,
      devCode: process.env.NODE_ENV === "production" ? undefined : code
    });
  }

  return NextResponse.json({
    ok: true,
    emailSent: true
  });
}
