import { NextResponse } from "next/server";

import { verifyUnsubscribeToken } from "@/lib/email-unsubscribe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unsubscribe(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const payload = verifyUnsubscribeToken(token);
  if (!payload) return { ok: false, status: 400 };

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.getUserById(payload.userId);
  const user = data.user;
  if (error || !user?.email || user.email.toLowerCase() !== payload.email) {
    return { ok: false, status: 404 };
  }

  const update = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      marketing_email_consent: false,
      marketing_email_unsubscribed_at: new Date().toISOString()
    }
  });
  return { ok: !update.error, status: update.error ? 500 : 200 };
}

export async function GET(request: Request) {
  const result = await unsubscribe(request);
  const title = result.ok ? "Marketing emails disabled" : "The unsubscribe link is invalid";
  const detail = result.ok
    ? "You will no longer receive monthly Maskines marketplace emails. Essential account and transaction messages remain enabled."
    : "Please open the latest Maskines email and try its unsubscribe link again.";
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;background:#eef3f7;font-family:Arial,sans-serif;color:#10243e"><main style="max-width:560px;margin:12vh auto;padding:36px;border:1px solid #d8e2eb;border-radius:20px;background:#fff;text-align:center"><h1>${title}</h1><p style="color:#60738a;line-height:1.6">${detail}</p><a href="/" style="display:inline-block;margin-top:16px;padding:13px 20px;border-radius:10px;background:#ff7417;color:#fff;text-decoration:none;font-weight:800">Maskines</a></main></body></html>`, {
    status: result.status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request) {
  const result = await unsubscribe(request);
  return NextResponse.json({ ok: result.ok }, { status: result.status });
}
