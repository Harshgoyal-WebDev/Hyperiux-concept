// Sending the contact form.
//
// INTEGRATION REQUIRED — this project has no form backend yet. Set
//   NEXT_PUBLIC_CONTACT_ENDPOINT=https://…   (in .env.local / Vercel env)
// to a service that accepts a JSON POST of
//   { name, email, company, projectType, details, source: "contact-us" }
// and answers 2xx on success (a Next.js route handler that sends the mail, a
// Formspree / Basin / HubSpot form endpoint, etc.). Until it is set, the form
// does not pretend to send: it says so and offers the visitor a ready-written
// email to hi@hyperiux.com instead (ContactForm).

// (as on hyperiux-staging: hi@)
export const CONTACT_EMAIL = "hi@hyperiux.com";
const ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;

export async function submitContact(fields, { signal } = {}) {
  if (!ENDPOINT) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...fields, source: "contact-us" }),
      signal,
    });
    if (!res.ok) return { ok: false, reason: "server", status: res.status };
    return { ok: true };
  } catch (err) {
    if (err?.name === "AbortError") return { ok: false, reason: "aborted" };
    return { ok: false, reason: "network" };
  }
}

// the same message as an email, for when the form can't send it
export function mailtoFor(fields) {
  const subject = `Project enquiry — ${fields.name || "Hyperiux"}${fields.company ? ` (${fields.company})` : ""}`;
  const lines = [fields.details || "", "", `— ${fields.name || ""}`, fields.email || ""];
  if (fields.company) lines.push(`Company / brand: ${fields.company}`);
  if (fields.projectType) lines.push(`Project type: ${fields.projectType}`);
  const body = lines.join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
