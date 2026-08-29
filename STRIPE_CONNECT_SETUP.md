# Maskines Commerce – käyttöönotto

## 1. Tietokanta

Aja Supabase SQL Editorissa migraatiot tässä järjestyksessä:

1. `supabase/commerce-stripe-connect.sql`
2. `supabase/commerce-storefront-and-shipping.sql`
3. `supabase/commerce-seller-fee-settings.sql`
4. `supabase/commerce-auto-close-sold-products.sql`
5. `supabase/commerce-multi-seller-discounts.sql`

Migraatio luo yritykset, tuotteet, tilaukset, tilausrivit, kuitit, webhook-lokin, tuotekuvien bucketin, RLS-säännöt sekä tietokantatason julkaisulukon.

## 2. Palvelimen ympäristömuuttujat

Kopioi `.env.local.example`-tiedoston Stripe- ja Posti-muuttujat Netlifyyn ja paikalliseen `.env.local`-tiedostoon. Salainen Stripe-avain kuuluu vain `STRIPE_SECRET_KEY`-muuttujaan. Sitä ei saa lisätä `NEXT_PUBLIC_`-alkuiseen muuttujaan tai lähdekoodiin.

Tuotantoon tarvitaan vähintään:

- `NEXT_PUBLIC_SITE_URL=https://maskines.fi`
- `STRIPE_SECRET_KEY`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- nykyiset Supabase service role -asetukset
- nykyiset Gmail- tai Resend-sähköpostiasetukset

Upotettu maksunäkymä tarvitsee lisäksi `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`-avaimen. Salainen avain ja webhook-avaimet pysyvät aina vain palvelimella.

## 3. Stripe Connect

Ota Stripe Dashboardissa Connect käyttöön ja määritä platform profile. Lisää alustatilin webhook:

`https://maskines.fi/api/commerce/stripe/webhook`

Valitse alustatilin tapahtumat:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Tallenna endpointin signing secret muuttujaan `STRIPE_WEBHOOK_SECRET`.

Lisää samaan osoitteeseen myös Connected accounts -webhook ja valitse:

- `account.updated`

Tallenna endpointin signing secret palvelimelle muuttujaan `STRIPE_CONNECT_WEBHOOK_SECRET`.

## 4. Posti Pickup Point API

Luo Postin Developer Portalissa OAuth 2.0 client credentials ja anna palvelimelle `POSTI_CLIENT_ID` sekä `POSTI_CLIENT_SECRET`. Integraatio käyttää oletuksena Posti API `2026-04` -versiota, token-osoitetta `https://gateway-auth.posti.fi/api/v1/token` ja noutopisteosoitetta `https://gateway.posti.fi/2026-04/pickuppoints`. Osoitteet voi tarvittaessa ohittaa `POSTI_OAUTH_TOKEN_URL`- ja `POSTI_PICKUP_POINTS_URL`-muuttujilla.

## 5. Ensimmäinen testaus

Käytä ensin Stripen test mode -avaimia ja testaa koko ketju:

1. Luo yritystili ja täytä `/yritys`.
2. Lähetä yritys tarkistettavaksi.
3. Hyväksy yritys `/admin/commerce`-näkymässä.
4. Tee Stripe Standard -onboarding.
5. Lisää yksi vain noudettava ja yksi Posti-tuote.
6. Tee maksu Stripe testikortilla.
7. Lisää saman maksun alle tuotteita kahdelta yritykseltä ja valitse kummallekin toimitus.
8. Tarkista yksi ostajan maksu, yrityskohtaiset alitilaukset, 1 % Maskines-osuus, myyjäkohtaiset siirrot, varaston vähennys, yhdistetty kuitti, myyjien omat ilmoitukset ja webhook-loki.

Siirry live-avaimiin vasta onnistuneen testikierroksen jälkeen.
