// Sending an enquiry.
//
// There is no form backend in this project yet: set
//   NEXT_PUBLIC_CONTACT_ENDPOINT=https://…
// to any service that takes a JSON POST (a route handler that mails it, a
// Formspree / HubSpot endpoint…) and answers 2xx. Until then the form says it
// can't send, and offers the same message as a ready-written email instead.

export const EMAIL = "hi@hyperiux.com";
const ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;

function summary(f) {
  return [
    `Industry: ${f.industry.trim()}`,
    `Website type: ${f.siteType}`,
    `Go live: ${f.goLive}`,
    f.website.trim() && `Current website: ${f.website.trim()}`,
    "",
    `${f.name.trim()} — ${f.company.trim()}`,
    f.email.trim(),
    f.phone.trim(),
    "",
    `Heard about us: ${f.heard}`,
  ]
    .filter((l) => l !== false && l !== undefined)
    .join("\n");
}

export function mailtoFor(f) {
  const subject = `Project enquiry — ${f.name.trim()} (${f.company.trim()})`;
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary(f))}`;
}

export async function sendEnquiry(f) {
  const mailto = mailtoFor(f);
  if (!ENDPOINT) return { ok: false, configured: false, mailto };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...f, summary: summary(f), page: window.location.href, source: "contact-v2" }),
    });
    return res.ok ? { ok: true } : { ok: false, configured: true, mailto };
  } catch {
    return { ok: false, configured: true, mailto };
  }
}
