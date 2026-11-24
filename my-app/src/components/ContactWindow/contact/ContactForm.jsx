"use client";

import { useId, useRef, useState } from "react";
import { CONTACT_EMAIL, mailtoFor, submitContact } from "./submitContact";

// The contact form: name, email, company / brand (optional), project type
// (optional), project details. Checked as each field is left and again on
// sending; while sending the button says so; then a confirmation, or an
// error with a way to send it by email instead.

export const PROJECT_TYPES = ["Brand & identity", "Website", "3D & immersive", "Product / app", "Campaign", "Something else"];

const EMPTY = { name: "", email: "", company: "", projectType: "", details: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Please tell us your name.";
  if (!f.email.trim()) e.email = "We need an email to reply to.";
  else if (!EMAIL_RE.test(f.email.trim())) e.email = "That email doesn't look quite right.";
  if (!f.details.trim()) e.details = "Tell us a little about the project.";
  else if (f.details.trim().length < 20) e.details = "A little more detail, please (20 characters or more).";
  return e;
}

const labelCls = "block text-[0.68rem] uppercase tracking-[0.22em] text-[#f1f1f1]/45 transition-colors group-focus-within:text-[#ff5f00]";
const fieldCls =
  "mt-3 w-full rounded-none border-0 border-b bg-transparent pb-3 text-[1.05rem] text-[#f1f1f1] outline-none transition-colors placeholder:text-[#f1f1f1]/25 focus:border-[#ff5f00] focus-visible:outline-none";

function Field({ id, label, optional, error, children }) {
  return (
    <div className="group relative">
      <label htmlFor={id} className={labelCls}>
        {label}
        {optional && <span className="ml-2 normal-case tracking-normal text-[#f1f1f1]/30">(optional)</span>}
      </label>
      {children}
      <p id={`${id}-error`} aria-live="polite" className={`mt-2 min-h-[1.1em] text-[0.8rem] text-[#ff7a2e] transition-opacity ${error ? "opacity-100" : "opacity-0"}`}>
        {error || ""}
      </p>
    </div>
  );
}

export default function ContactForm() {
  const uid = useId();
  const id = (k) => `${uid}-${k}`;
  const [fields, setFields] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ kind: "idle" });
  const formRef = useRef(null);
  const sending = status.kind === "sending";

  const set = (k) => (e) => {
    const next = { ...fields, [k]: e.target.value };
    setFields(next);
    if (touched[k]) setErrors(validate(next));
    if (status.kind === "error") setStatus({ kind: "idle" });
  };
  const blur = (k) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validate(fields));
  };
  const shown = (k) => (touched[k] ? errors[k] : undefined);
  const border = (k) => (shown(k) ? "border-[#ff7a2e]" : "border-[#f1f1f1]/18");

  async function onSubmit(e) {
    e.preventDefault();
    if (sending) return;
    const errs = validate(fields);
    setErrors(errs);
    setTouched({ name: true, email: true, details: true });
    if (Object.keys(errs).length) {
      // (to the first field that needs attention)
      const first = ["name", "email", "details"].find((k) => errs[k]);
      formRef.current?.querySelector(`#${CSS.escape(id(first))}`)?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    const res = await submitContact({
      name: fields.name.trim(),
      email: fields.email.trim(),
      company: fields.company.trim(),
      projectType: fields.projectType,
      details: fields.details.trim(),
    });
    if (res.ok) {
      setStatus({ kind: "sent", name: fields.name.trim().split(/\s+/)[0] });
      setFields(EMPTY);
      setTouched({});
      setErrors({});
    } else {
      setStatus({ kind: "error", reason: res.reason, mailto: mailtoFor(fields) });
    }
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className="flex min-h-[28rem] flex-col justify-center border-t border-[#f1f1f1]/15 pt-10">
        <span aria-hidden className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#ff5f00] text-[#ff5f00]">
          ✓
        </span>
        <p className="text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.1] tracking-[-0.02em]">Message received{status.name ? `, ${status.name}` : ""}.</p>
        <p className="mt-4 max-w-[28rem] text-[#f1f1f1]/55">We read every message ourselves and will reply within two working days.</p>
        <button type="button" onClick={() => setStatus({ kind: "idle" })} className="mt-10 w-fit text-[0.75rem] uppercase tracking-[0.22em] text-[#f1f1f1]/60 underline-offset-[6px] transition-colors hover:text-[#ff5f00] hover:underline focus-visible:text-[#ff5f00] focus-visible:underline focus-visible:outline-none">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-describedby={id("intro")} className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      <p id={id("intro")} className="sr-only">
        Fields marked optional can be left empty. All other fields are required.
      </p>
      <Field id={id("name")} label="Name" error={shown("name")}>
        <input id={id("name")} name="name" autoComplete="name" required value={fields.name} onChange={set("name")} onBlur={blur("name")} aria-invalid={!!shown("name")} aria-describedby={`${id("name")}-error`} placeholder="Your name" className={`${fieldCls} ${border("name")}`} />
      </Field>
      <Field id={id("email")} label="Email" error={shown("email")}>
        <input id={id("email")} name="email" type="email" inputMode="email" autoComplete="email" required value={fields.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={!!shown("email")} aria-describedby={`${id("email")}-error`} placeholder="you@company.com" className={`${fieldCls} ${border("email")}`} />
      </Field>
      <Field id={id("company")} label="Company / Brand" optional>
        <input id={id("company")} name="company" autoComplete="organization" value={fields.company} onChange={set("company")} placeholder="Where you're from" className={`${fieldCls} border-[#f1f1f1]/18`} />
      </Field>
      <Field id={id("type")} label="Project type" optional>
        <div className="relative">
          <select id={id("type")} name="projectType" value={fields.projectType} onChange={set("projectType")} className={`${fieldCls} cursor-pointer appearance-none border-[#f1f1f1]/18 pr-8 ${fields.projectType ? "" : "text-[#f1f1f1]/25"}`}>
            <option value="" className="bg-[#0b0b0b] text-[#f1f1f1]">
              Choose one
            </option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#0b0b0b] text-[#f1f1f1]">
                {t}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-1 top-[55%] -translate-y-1/2 text-[0.7rem] text-[#f1f1f1]/40">
            ▾
          </span>
        </div>
      </Field>
      <div className="md:col-span-2">
        <Field id={id("details")} label="Project details" error={shown("details")}>
          <textarea id={id("details")} name="details" required rows={4} value={fields.details} onChange={set("details")} onBlur={blur("details")} aria-invalid={!!shown("details")} aria-describedby={`${id("details")}-error`} placeholder="What are you building, and where could we help?" className={`${fieldCls} min-h-[7.5rem] resize-y leading-relaxed ${border("details")}`} />
        </Field>
      </div>

      <div className="flex flex-col gap-6 md:col-span-2 md:flex-row md:items-center md:justify-between">
        <div aria-live="assertive" className="min-h-[1.2em] max-w-[26rem] text-[0.85rem] leading-relaxed">
          {status.kind === "error" && (
            <p role="alert" className="text-[#f1f1f1]/70">
              {status.reason === "not-configured" ? "Our form can't send messages just yet. " : "Something went wrong sending that. "}
              <a href={status.mailto} className="text-[#ff5f00] underline underline-offset-4 hover:text-[#ff7a2e] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#ff5f00]">
                Email it to {CONTACT_EMAIL}
              </a>{" "}
              instead. Your message is already written into it.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className="group/btn relative inline-flex h-14 shrink-0 items-center justify-center gap-3 overflow-hidden rounded-full border border-[#ff5f00] px-9 text-[0.8rem] font-medium uppercase tracking-[0.22em] text-[#f1f1f1] transition-colors duration-300 hover:text-[#050505] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5f00] disabled:cursor-wait"
        >
          <span aria-hidden className="absolute inset-0 origin-bottom scale-y-0 bg-[#ff5f00] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/btn:scale-y-100" />
          <span className="relative">{sending ? "Sending…" : "Send message"}</span>
          <span aria-hidden className={`relative transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5 ${sending ? "animate-pulse" : ""}`}>
            ↗
          </span>
        </button>
      </div>
    </form>
  );
}
