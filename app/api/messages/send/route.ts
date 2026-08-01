import { NextResponse } from "next/server";

import { sendGmailMessage } from "@/lib/gmail";
import { newMessageEmail, notificationEmailLocale } from "@/lib/notification-emails";
import { pagePath } from "@/lib/routes";
import { absoluteSiteUrl } from "@/lib/site-url";
import { requireUserFromRequest } from "@/lib/supabase-admin";
import type { ChatMessage, Conversation, UserProfile } from "@/lib/supabase";

type SendMessageBody = {
  conversation_id?: unknown;
  content?: unknown;
  image?: unknown;
};

const MAX_MESSAGE_IMAGE_BYTES = 2_500_000;

function inlineImage(value: string) {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;

  const contentType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.length === 0 || bytes.length > MAX_MESSAGE_IMAGE_BYTES) return null;

  return {
    bytes,
    contentType,
    extension: contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1]
  };
}

function uuid(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : "";
}

function profileName(profile: Partial<UserProfile> | null, fallback: string) {
  return (
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.name?.trim() ||
    fallback
  );
}

function markerMap(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, string>
    : {};
}

function userIsOnline(profile: Partial<UserProfile> | null) {
  if (!profile?.online || !profile.last_seen) return false;
  const lastSeen = new Date(profile.last_seen).getTime();
  return Number.isFinite(lastSeen) && lastSeen > Date.now() - 60_000;
}

export async function POST(request: Request) {
  try {
    const { admin, user } = await requireUserFromRequest(request);
    const body = await request.json().catch(() => ({})) as SendMessageBody;
    const conversationId = uuid(body.conversation_id);
    const content =
      typeof body.content === "string" ? body.content.trim().slice(0, 5000) : "";
    const requestedImage =
      typeof body.image === "string" ? body.image.trim() : "";

    if (!conversationId || (!content && !requestedImage)) {
      return NextResponse.json(
        { error: "Keskustelu tai viesti puuttuu." },
        { status: 400 }
      );
    }

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle<Conversation>();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: conversationError?.message ?? "Keskustelua ei löytynyt." },
        { status: 404 }
      );
    }

    const senderIsBuyer = conversation.buyer_id === user.id;
    const senderIsSeller = conversation.seller_id === user.id;
    if (!senderIsBuyer && !senderIsSeller) {
      return NextResponse.json(
        { error: "Et kuulu tähän keskusteluun." },
        { status: 403 }
      );
    }

    if (conversation.expires_at) {
      const expiresAt = new Date(conversation.expires_at).getTime();
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        return NextResponse.json(
          { error: "Keskustelun 20 päivän viestiaika on päättynyt." },
          { status: 409 }
        );
      }
    }

    const receiverId = senderIsBuyer
      ? conversation.seller_id
      : conversation.buyer_id;

    let image: string | null = null;

    if (requestedImage.startsWith("data:image/")) {
      const uploadImage = inlineImage(requestedImage);
      if (!uploadImage) {
        return NextResponse.json(
          { error: "Kuvaa ei voitu käsitellä tai se on liian suuri." },
          { status: 400 }
        );
      }

      const imagePath = `${user.id}/messages/${crypto.randomUUID()}.${uploadImage.extension}`;
      const { error: uploadError } = await admin.storage
        .from("listing-images")
        .upload(imagePath, uploadImage.bytes, {
          cacheControl: "31536000",
          contentType: uploadImage.contentType,
          upsert: false
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Kuvan lataus epäonnistui: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: publicImage } = admin.storage
        .from("listing-images")
        .getPublicUrl(imagePath);
      image = publicImage.publicUrl || null;
    } else if (requestedImage) {
      if (!/^https:\/\//i.test(requestedImage) || requestedImage.length > 2000) {
        return NextResponse.json(
          { error: "Kuvan osoite ei kelpaa." },
          { status: 400 }
        );
      }
      image = requestedImage;
    }

    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        listing_id: conversation.listing_id,
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        image
      })
      .select()
      .single<ChatMessage>();

    if (insertError || !message) {
      return NextResponse.json(
        { error: insertError?.message ?? "Viestin lähetys epäonnistui." },
        { status: 500 }
      );
    }

    // Gmail is best-effort: an email problem must not undo a sent chat message.
    try {
      const [
        { data: profiles },
        { data: receiverAuth },
        { data: listing }
      ] = await Promise.all([
        admin
          .from("profiles")
          .select("id,email,first_name,last_name,full_name,name,company_name,online,last_seen,preferred_locale")
          .in("id", [user.id, receiverId])
          .returns<Partial<UserProfile>[]>(),
        admin.auth.admin.getUserById(receiverId),
        admin
          .from("listings")
          .select("title")
          .eq("id", conversation.listing_id)
          .maybeSingle<{ title: string }>()
      ]);
      const senderProfile =
        profiles?.find((profile) => profile.id === user.id) ?? null;
      const receiverProfile =
        profiles?.find((profile) => profile.id === receiverId) ?? null;
      const receiver = receiverAuth.user;
      const receiverEmail = receiver?.email || receiverProfile?.email;
      const metadata = receiver?.user_metadata ?? {};
      const markers = markerMap(metadata.message_email_notified_conversations);

      if (
        receiverEmail &&
        metadata.message_email_notifications !== false &&
        !userIsOnline(receiverProfile) &&
        !markers[conversation.id]
      ) {
        const locale = notificationEmailLocale(
          metadata.locale ?? receiverProfile?.preferred_locale
        );
        const conversationUrl = absoluteSiteUrl(
          `${pagePath("messages", locale)}/${conversation.listing_id}?conversation=${conversation.id}`
        );
        const email = newMessageEmail({
          locale,
          senderName: profileName(senderProfile, user.email || "Maskines-käyttäjä"),
          listingTitle:
            conversation.listing_title?.trim() ||
            listing?.title?.trim() ||
            "Maskines",
          conversationUrl,
          settingsUrl: absoluteSiteUrl(pagePath("settings", locale))
        });

        await sendGmailMessage({ to: receiverEmail, ...email });

        const recentMarkers = Object.fromEntries(
          Object.entries(markers).slice(-49)
        );
        await admin.auth.admin.updateUserById(receiverId, {
          user_metadata: {
            ...metadata,
            message_email_notified_conversations: {
              ...recentMarkers,
              [conversation.id]: new Date().toISOString()
            }
          }
        });
      }
    } catch (emailError) {
      console.error("Message notification email failed:", emailError);
    }

    return NextResponse.json({ data: message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Viestin lähetys epäonnistui.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Kirjautuminen") ? 401 : 500 }
    );
  }
}
