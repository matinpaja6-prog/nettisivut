import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type MarkReadBody = {
  conversationId?: string;
  readAt?: number;
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Supabase ei ole konfiguroitu." },
        { status: 500 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: "Kirjautuminen puuttuu." },
        { status: 401 }
      );
    }

    const body =
      await request.json().catch(() => ({})) as MarkReadBody;
    const conversationId =
      typeof body.conversationId === "string"
        ? body.conversationId
        : "";
    const readAt =
      Number.isFinite(Number(body.readAt))
        ? Number(body.readAt)
        : Date.now();

    if (!conversationId) {
      return NextResponse.json(
        { error: "Keskustelu puuttuu." },
        { status: 400 }
      );
    }

    const userScopedClient =
      createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });

    const {
      data: userData,
      error: userError
    } = await userScopedClient.auth.getUser(token);
    const userId = userData.user?.id ?? "";

    if (userError || !userId) {
      return NextResponse.json(
        { error: "Kirjautuminen ei ole voimassa." },
        { status: 401 }
      );
    }

    let { error } =
      await userScopedClient
        .from("messages")
        .update({
          read: true,
          read_at: new Date(readAt).toISOString()
        })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", userId)
        .is("read_at", null);

    if (
      error &&
      error.message.includes("read") &&
      (
        error.message.includes("Could not find") ||
        error.message.includes("schema cache") ||
        error.message.includes("column")
      )
    ) {
      const fallback =
        await userScopedClient
          .from("messages")
          .update({
            read_at: new Date(readAt).toISOString()
          })
          .eq("conversation_id", conversationId)
          .eq("receiver_id", userId)
          .is("read_at", null);

      error = fallback.error;
    }

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Luetuksi merkinta epaonnistui."
      },
      { status: 500 }
    );
  }
}
