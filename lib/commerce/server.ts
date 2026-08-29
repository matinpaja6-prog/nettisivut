import "server-only";

import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseAdmin, requireUserFromRequest } from "@/lib/supabase-admin";
import { companyRecord } from "@/lib/commerce/company-record";

export function errorResponse(error: unknown, fallback: string, status = 500) {
  const message = error instanceof Error ? error.message : fallback;
  const authError = /kirjautuminen/i.test(message);
  const accessError = /vain yritystileille|vahvista yritys|vain Maskines-admin/i.test(message);
  return NextResponse.json(
    { error: message },
    { status: authError ? 401 : accessError ? 403 : status }
  );
}

export async function requireCommerceUser(request: Request) {
  return requireUserFromRequest(request);
}

export async function requireAdminUser(request: Request) {
  const { admin, user } = await requireUserFromRequest(request);
  const { data, error } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle<{ user_id: string }>();

  if (error || !data) throw new Error("Vain Maskines-admin voi tehdä tämän toiminnon.");
  return { admin, user };
}

export async function getOwnedCompany(user: User) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("companies")
    .select("*")
    .eq("owner_user_id", user.id)
    .maybeSingle<Record<string, unknown>>();

  if (error) throw error;
  return data ? companyRecord(data) : null;
}

export function normalizeText(value: unknown, max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function normalizeMultiline(value: unknown, max = 5000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function optionalText(value: unknown, max = 500) {
  return normalizeText(value, max) || null;
}

export function integer(value: unknown, min = 0, max = 2_000_000_000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function nullableInteger(value: unknown, min = 0, max = 2_000_000_000) {
  if (value === null || value === undefined || value === "") return null;
  return integer(value, min, max);
}

export function nullableNumber(value: unknown, min = 0, max = 1_000_000) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
