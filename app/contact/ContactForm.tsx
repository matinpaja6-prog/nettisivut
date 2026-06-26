"use client";

import { useState } from "react";
import { Check, Mail, Send } from "lucide-react";

type FormState = "idle" | "sending" | "success" | "error";

type FormValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
  acceptedTerms: boolean;
};

type ContactFormProps = {
  embedded?: boolean;
};

const initialValues: FormValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
  acceptedTerms: false
};

export default function ContactForm({ embedded = false }: ContactFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [status, setStatus] = useState<FormState>("idle");
  const [feedback, setFeedback] = useState("");

  const updateField =
    <Key extends keyof FormValues>(field: Key) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue =
        event.target instanceof HTMLInputElement && event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      setValues((current) => ({ ...current, [field]: nextValue }));
    };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setFeedback("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(body?.error || "Viestin lähetys epäonnistui.");
      }

      setValues(initialValues);
      setStatus("success");
      setFeedback("Viesti lähetettiin. Vastaamme suoraan antamaasi sähköpostiin.");
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error ? error.message : "Viestin lähetys epäonnistui.");
    }
  }

  const formSection = (
    <section className={`contact-shell contact-form-section${embedded ? " about-contact-form" : ""}`} aria-label="Yhteydenottolomake">
      <form className="contact-form-card" onSubmit={onSubmit}>
        <div className="contact-form-head">
          <span className="contact-form-icon" aria-hidden="true">
            <Mail size={24} />
          </span>
          <div>
            <h2>Ota yhteyttä</h2>
            <p>Kirjoita yhteystiedot ja asia mahdollisimman selkeästi.</p>
          </div>
        </div>

        <label className="contact-field">
          <span>Nimi</span>
          <input
            autoComplete="name"
            name="name"
            onChange={updateField("name")}
            placeholder="Matti Meikäläinen"
            required
            type="text"
            value={values.name}
          />
        </label>

        <label className="contact-field">
          <span>Sähköposti</span>
          <input
            autoComplete="email"
            inputMode="email"
            name="email"
            onChange={updateField("email")}
            placeholder="matti.meikalainen@gmail.com"
            required
            type="email"
            value={values.email}
          />
        </label>

        <label className="contact-field">
          <span>Otsikko</span>
          <input
            name="subject"
            onChange={updateField("subject")}
            placeholder="Mitä asia koskee?"
            required
            type="text"
            value={values.subject}
          />
        </label>

        <label className="contact-field">
          <span>Viesti</span>
          <textarea
            minLength={10}
            name="message"
            onChange={updateField("message")}
            placeholder="Kirjoita viesti tähän"
            required
            rows={7}
            value={values.message}
          />
        </label>

        <label className="contact-terms">
          <input
            checked={values.acceptedTerms}
            name="acceptedTerms"
            onChange={updateField("acceptedTerms")}
            required
            type="checkbox"
          />
          <span>
            <Check size={15} aria-hidden="true" />
          </span>
          <strong>Hyväksyn Maskinesin käyttöehdot</strong>
        </label>

        <button className="contact-submit" disabled={status === "sending"} type="submit">
          <Send size={18} aria-hidden="true" />
          <span>{status === "sending" ? "Lähetetään..." : "Lähetä viesti"}</span>
        </button>

        {feedback ? (
          <p className={`contact-feedback contact-feedback-${status}`} role="status">
            {feedback}
          </p>
        ) : null}
      </form>
    </section>
  );

  if (embedded) {
    return formSection;
  }

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="contact-shell contact-hero-inner">
          <span className="contact-kicker">Maskines-tuki</span>
          <h1>Ota yhteyttä</h1>
          <p>
            Lähetä meille viesti lomakkeella. Se tulee suoraan sähköpostiin, ja kun vastaamme
            siihen sähköpostista, vastaus lähtee antamaasi osoitteeseen.
          </p>
        </div>
      </section>

      {formSection}
    </main>
  );
}
