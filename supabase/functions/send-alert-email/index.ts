import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "KelkkaParts <noreply@kelkkaparts.fi>";

serve(async (req) => {
  try {
    const body = await req.json() as {
      to: string;
      alert_label: string;
      listing_id: string;
      listing_title: string;
      listing_price: number;
      listing_url: string;
    };

    const html = `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
        <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e8edf5;">
          <div style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:24px 28px;">
            <h1 style="color:white;margin:0;font-size:20px;font-weight:800;">🔔 Hakuvahti löysi osuman!</h1>
          </div>
          <div style="padding:28px;">
            <p style="color:#64748b;margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Hakuvahti</p>
            <p style="color:#0f172a;margin:0 0 24px;font-size:18px;font-weight:700;">${body.alert_label}</p>

            <div style="background:#f8fafc;border:1px solid #e8edf5;border-radius:12px;padding:20px;margin-bottom:24px;">
              <p style="color:#94a3b8;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;">Uusi ilmoitus</p>
              <p style="color:#0f172a;font-size:17px;font-weight:700;margin:0 0 8px;">${body.listing_title}</p>
              <p style="color:#1d4ed8;font-size:22px;font-weight:800;margin:0;">${body.listing_price?.toLocaleString("fi-FI") ?? "—"} €</p>
            </div>

            <a href="${body.listing_url}"
               style="display:inline-block;background:#1d4ed8;color:white;padding:13px 28px;border-radius:11px;font-weight:700;font-size:14px;text-decoration:none;">
              Katso ilmoitus →
            </a>

            <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
              Voit hallita hakuvahtejasi osoitteessa
              <a href="https://kelkkaparts.fi/search-alerts" style="color:#3b82f6;">kelkkaparts.fi/search-alerts</a>
            </p>
          </div>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [body.to],
        subject: `🔔 Hakuvahti: ${body.listing_title}`,
        html
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
