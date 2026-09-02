import UiText from "@/app/components/UiText";
import Link from "@/app/components/LocalizedLink";

export default function NotFound() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "32px 18px", background: "#f3f6f8", color: "#0b2239" }}>
      <section style={{ width: "min(620px, 100%)", boxSizing: "border-box", padding: "44px 32px", border: "1px solid #d4dee7", borderRadius: 20, background: "#fff", boxShadow: "0 18px 48px rgba(11,34,57,.12)", textAlign: "center" }}>
        <p style={{ margin: "0 0 8px", color: "#ff6500", fontSize: 13, fontWeight: 900, letterSpacing: ".11em", textTransform: "uppercase" }}>404</p>
        <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 42px)" }}><UiText text={"Sivua ei löytynyt"} /></h1>
        <p style={{ margin: "16px auto 26px", color: "#5d7183", lineHeight: 1.6 }}><UiText text={"Osoite voi olla vanhentunut tai sisältö on poistettu."} /></p>
        <Link href="/" style={{ minHeight: 46, display: "inline-flex", alignItems: "center", padding: "0 24px", borderRadius: 10, background: "#ff6500", color: "#fff", fontWeight: 800, textDecoration: "none" }}><UiText text={"Takaisin etusivulle"} /></Link>
      </section>
    </main>
  );
}
