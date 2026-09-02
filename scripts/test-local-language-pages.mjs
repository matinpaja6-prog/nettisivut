import assert from "node:assert/strict";

// Read-only smoke test. Deliberately refuse non-local hosts.
const base = new URL(process.env.MASKINES_TEST_URL || "http://localhost:3000");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Use a local test server");

for (const [path, lang] of [["/", "fi"], ["/en", "en"], ["/sv", "sv"], ["/no", "nb"]]) {
  const response = await fetch(new URL(path, base), {
    headers: { cookie: "locale=fi", "x-maskines-locale": "fi" },
    signal: AbortSignal.timeout(30_000)
  });
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.equal(html.match(/<html[^>]*lang="([^"]+)"/)?.[1], lang, path);
  for (const alternate of ["fi", "en", "sv", "nb"]) {
    assert.ok(new RegExp(`href[Ll]ang="${alternate}"`).test(html), `${path}: alternate ${alternate}`);
  }
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  assert.ok(canonical, `${path}: canonical`);
  assert.equal(new URL(canonical).pathname, path);
  console.log(`PASS HTML ${path}: ${lang}, canonical and four language alternatives`);
}

const alias = await fetch(new URL("/eng", base), { redirect: "manual" });
assert.ok([307, 308].includes(alias.status));
assert.equal(new URL(alias.headers.get("location"), base).pathname, "/en");
const auth = await fetch(new URL("/no/logg-inn?mode=login&next=%2Fno%2Fselg&reason=sell", base));
assert.equal(auth.status, 200);
assert.match(auth.headers.get("x-robots-tag") || "", /noindex/);
const authHtml = await auth.text();
assert.ok(authHtml.includes('lang="nb"'));
assert.ok(authHtml.includes("Velkommen tilbake"));
assert.ok(authHtml.includes("Logg inn for å fortsette å opprette annonsen."));
console.log("PASS aliases and localized, non-indexable sell/login flow");

for (const path of ["/en/parts", "/sv/fordon"]) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, path);
  assert.equal(new URL(response.url).pathname, path, `${path}: no language-losing redirect`);
}
console.log("PASS localized parts and vehicle landing pages");
