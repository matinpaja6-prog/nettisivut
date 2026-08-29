import "server-only";

import { buildInternationalEmail, escapeEmailHtml, type EmailLocale } from "@/lib/email-template";

const copy = {
  fi: {
    approvedSubject: "Yrityksesi on vahvistettu Maskinesissa",
    approvedEyebrow: "YRITYS VAHVISTETTU",
    approvedTitle: "Yrityksesi on vahvistettu",
    approvedLead: "Yritystietosi on tarkistettu ja yritysmerkkisi on nyt aktiivinen Maskinesissa.",
    approvedBody: "Vahvistettu yritys lisää luottamusta ostajien keskuudessa ja näkyy yrityksesi profiilissa sekä ilmoituksissa.",
    approvedAction: "Avaa yritysprofiili",
    approvedNotice: "Sinun ei tarvitse tehdä mitään. Vahvistus pysyy voimassa, kun yritystietosi ovat ajan tasalla.",
    rejectedSubject: "Maskines-yritysvahvistusta ei voitu hyväksyä",
    rejectedEyebrow: "VAHVISTUS HYLÄTTY",
    rejectedTitle: "Yritysvahvistusta ei hyväksytty",
    rejectedLead: "Emme pystyneet vahvistamaan yritystäsi annetuilla tiedoilla.",
    rejectedBody: "Tarkista yrityksen nimi, Y-tunnus ja yhteystiedot. Voit korjata tiedot profiilissasi ja lähettää uuden vahvistuspyynnön.",
    rejectedAction: "Tarkista yritystiedot",
    reason: "Hylkäyksen syy",
    rejectedNotice: "Yritystilisi ja ilmoituksesi säilyvät käytössä, mutta vahvistetun yrityksen merkki ei ole aktiivinen."
  },
  en: {
    approvedSubject: "Your company has been verified on Maskines",
    approvedEyebrow: "COMPANY VERIFIED",
    approvedTitle: "Your company is verified",
    approvedLead: "Your company details have been reviewed and your verified badge is now active on Maskines.",
    approvedBody: "A verified company builds buyer confidence and is highlighted on your company profile and listings.",
    approvedAction: "Open company profile",
    approvedNotice: "No action is required. Your verification remains active while your company details are kept up to date.",
    rejectedSubject: "Your Maskines company verification was not approved",
    rejectedEyebrow: "VERIFICATION DECLINED",
    rejectedTitle: "Company verification was not approved",
    rejectedLead: "We could not verify your company using the information provided.",
    rejectedBody: "Review your company name, registration number and contact details. You can update them in your profile and submit a new verification request.",
    rejectedAction: "Review company details",
    reason: "Reason",
    rejectedNotice: "Your company account and listings remain available, but the verified company badge is not active."
  },
  sv: {
    approvedSubject: "Ditt företag har verifierats på Maskines",
    approvedEyebrow: "FÖRETAG VERIFIERAT",
    approvedTitle: "Ditt företag är verifierat",
    approvedLead: "Dina företagsuppgifter har granskats och verifieringsmärket är nu aktivt på Maskines.",
    approvedBody: "Ett verifierat företag ökar köparnas förtroende och visas på företagets profil och annonser.",
    approvedAction: "Öppna företagsprofilen",
    approvedNotice: "Du behöver inte göra något. Verifieringen förblir aktiv så länge företagsuppgifterna är aktuella.",
    rejectedSubject: "Din företagsverifiering på Maskines godkändes inte",
    rejectedEyebrow: "VERIFIERING AVSLAGEN",
    rejectedTitle: "Företagsverifieringen godkändes inte",
    rejectedLead: "Vi kunde inte verifiera företaget med de uppgifter som lämnades.",
    rejectedBody: "Kontrollera företagets namn, organisationsnummer och kontaktuppgifter. Du kan uppdatera uppgifterna i profilen och skicka en ny begäran.",
    rejectedAction: "Kontrollera företagsuppgifterna",
    reason: "Orsak",
    rejectedNotice: "Företagskontot och annonserna kan fortfarande användas, men märket för verifierat företag är inte aktivt."
  },
  no: {
    approvedSubject: "Bedriften din er verifisert på Maskines",
    approvedEyebrow: "BEDRIFT VERIFISERT",
    approvedTitle: "Bedriften din er verifisert",
    approvedLead: "Bedriftsopplysningene er kontrollert, og verifiseringsmerket er nå aktivt på Maskines.",
    approvedBody: "En verifisert bedrift skaper tillit hos kjøpere og vises på bedriftsprofilen og annonsene dine.",
    approvedAction: "Åpne bedriftsprofilen",
    approvedNotice: "Du trenger ikke å gjøre noe. Verifiseringen forblir aktiv så lenge bedriftsopplysningene er oppdaterte.",
    rejectedSubject: "Bedriftsverifiseringen på Maskines ble ikke godkjent",
    rejectedEyebrow: "VERIFISERING AVSLÅTT",
    rejectedTitle: "Bedriftsverifiseringen ble ikke godkjent",
    rejectedLead: "Vi kunne ikke verifisere bedriften med opplysningene som ble sendt inn.",
    rejectedBody: "Kontroller bedriftsnavn, organisasjonsnummer og kontaktopplysninger. Du kan oppdatere dem i profilen og sende inn en ny forespørsel.",
    rejectedAction: "Kontroller bedriftsopplysningene",
    reason: "Årsak",
    rejectedNotice: "Bedriftskontoen og annonsene dine er fortsatt tilgjengelige, men merket for verifisert bedrift er ikke aktivt."
  }
} as const;

export function companyVerificationDecisionEmail(input: {
  locale: EmailLocale;
  decision: "approved" | "rejected";
  companyName: string;
  profileUrl: string;
  reason?: string | null;
}) {
  const text = copy[input.locale];
  const approved = input.decision === "approved";
  const title = approved ? text.approvedTitle : text.rejectedTitle;
  const lead = approved ? text.approvedLead : text.rejectedLead;
  const body = approved ? text.approvedBody : text.rejectedBody;
  const notice = approved ? text.approvedNotice : text.rejectedNotice;
  const reason = input.reason?.trim();
  const statusClass = approved ? "email-status-approved" : "email-status-rejected";
  const statusIcon = approved ? "&#10003;" : "&#10005;";
  const bodyHtml = `
    <div class="email-panel ${statusClass}" style="padding:20px;border:1px solid ${approved ? "#b9e4c7" : "#ffc5c5"};border-radius:14px;background:${approved ? "#effaf2" : "#fff3f3"};text-align:center;">
      <div style="margin:0 auto 11px;width:42px;height:42px;border-radius:50%;background:${approved ? "#16833e" : "#c62828"};color:#ffffff;font-size:24px;font-weight:900;line-height:42px;">${statusIcon}</div>
      <strong class="email-strong" style="display:block;color:#10243e;font-size:17px;line-height:23px;">${escapeEmailHtml(input.companyName)}</strong>
      <p class="email-copy" style="margin:9px 0 0;color:#52677a;font-size:14px;line-height:22px;">${escapeEmailHtml(body)}</p>
    </div>
    ${!approved && reason ? `<div class="email-notice" style="margin-top:15px;padding:16px 18px;border:1px solid #ffd0ad;border-radius:13px;background:#fff9f4;color:#6c5645;font-size:13px;line-height:20px;"><strong style="display:block;margin-bottom:4px;">${escapeEmailHtml(text.reason)}</strong>${escapeEmailHtml(reason)}</div>` : ""}`;

  return {
    subject: approved ? text.approvedSubject : text.rejectedSubject,
    text: [
      title,
      "",
      lead,
      body,
      !approved && reason ? `${text.reason}: ${reason}` : "",
      "",
      `${approved ? text.approvedAction : text.rejectedAction}: ${input.profileUrl}`,
      "",
      notice
    ].filter(Boolean).join("\n"),
    html: buildInternationalEmail({
      locale: input.locale,
      preheader: lead,
      eyebrow: approved ? text.approvedEyebrow : text.rejectedEyebrow,
      title,
      lead,
      bodyHtml,
      action: {
        label: approved ? text.approvedAction : text.rejectedAction,
        url: input.profileUrl
      },
      notice
    })
  };
}
