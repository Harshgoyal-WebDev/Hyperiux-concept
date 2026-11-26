"use client";

import { useId, useRef, useState } from "react";
import PillButton from "./PillButton";
import { CONTACT_EMAIL, mailtoFor, submitContact } from "./submitContact";

// The enquiry form (after weareenigma-next's contact form): 01 about the
// project, 02 about the visitor, 03 how they heard of us, and the privacy
// agreement — each question on the left, its field on the right. Checked as
// each field is left and again on sending; while sending the button says
// so; then a confirmation, or an error with a way to send it by email
// instead (submitContact.js — the same backend as before).

const SITE_TYPES = ["Marketing", "E-commerce", "SaaS", "Portfolio", "Blog", "Web App"];
const HEARD_FROM = ["Search", "Social", "Referral", "Advertisement", "Other"];
const EMPTY = { industry: "", siteType: "", goLive: "", currentUrl: "", fullName: "", company: "", email: "", phone: "", heardFrom: "", terms: false };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ORDER = ["industry", "siteType", "goLive", "currentUrl", "fullName", "company", "email", "phone", "heardFrom", "terms"];

function validate(f) {
  const e = {};
  if (f.industry.trim().length < 2) e.industry = "Industry is required.";
  if (!f.siteType) e.siteType = "Please select a website type.";
  if (!f.goLive) e.goLive = "Please enter a target date.";
  if (f.currentUrl.trim() && !/^https?:\/\/.+/i.test(f.currentUrl.trim())) e.currentUrl = "Please enter a valid URL (including http/https) or leave blank.";
  if (f.fullName.trim().length < 2) e.fullName = "Your name is required.";
  if (f.company.trim().length < 2) e.company = "Company name is required.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Invalid email address.";
  if (f.phone.trim() && !/^\+?[\d\s-]{10,18}$/.test(f.phone.trim())) e.phone = "Phone number must be 10–15 digits.";
  if (!f.heardFrom) e.heardFrom = "Please tell us how you heard about us.";
  if (!f.terms) e.terms = "You must agree to the terms.";
  return e;
}

const fieldCls =
  "h-[3.5vw] min-h-11 w-full rounded-[1vw] border bg-white px-[1.2vw] text-[1.1vw] text-[#1a1a1a] outline-none transition-colors placeholder:text-[#595959] focus:border-[#111111] max-md:rounded-[2.5vw] max-md:px-[4vw] max-md:text-[3.8vw]";

function Row({ id, question, error, children }) {
  return (
    <div className="flex w-full justify-between max-md:flex-col max-md:gap-[3vw]">
      <label htmlFor={id} className="w-[45%] pt-[1vw] max-md:w-full max-md:pt-0">
        {question}
      </label>
      <div className="w-[55%] max-md:w-full">
        {children}
        <p id={`${id}-error`} aria-live="polite" className={`mt-[0.4vw] text-[0.9vw] text-[#d93f00] max-md:mt-1.5 max-md:text-[3.2vw] ${error ? "" : "hidden"}`}>
          {error || ""}
        </p>
      </div>
    </div>
  );
}

function Select({ id, value, onChange, onBlur, options, invalid }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={onChange} onBlur={onBlur} aria-invalid={invalid} aria-describedby={`${id}-error`} className={`${fieldCls} cursor-pointer appearance-none pr-[3vw] ${value ? "" : "text-[#595959]"} ${invalid ? "border-[#d93f00]" : "border-black/15"}`}>
        <option value="">Please Select</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg aria-hidden className="pointer-events-none absolute right-[1.2vw] top-1/2 h-[0.8vw] min-h-2.5 w-[0.8vw] min-w-2.5 -translate-y-1/2 text-[#595959] max-md:right-[4vw]" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const Rule = () => <div className="h-px w-full bg-black/20 max-md:my-[3vw]" />;
const Step = ({ children }) => <h4 className="text-[1.8vw] leading-tight max-md:text-[5.4vw]">{children}</h4>;

export default function EnquiryForm() {
  const uid = useId();
  const id = (k) => `${uid}-${k}`;
  const [fields, setFields] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ kind: "idle" });
  const formRef = useRef(null);
  const sending = status.kind === "sending";

  const set = (k) => (e) => {
    const next = { ...fields, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value };
    setFields(next);
    if (touched[k] || k === "terms") setErrors(validate(next));
    if (status.kind === "error") setStatus({ kind: "idle" });
  };
  const blur = (k) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(validate(fields));
  };
  const shown = (k) => (touched[k] ? errors[k] : undefined);
  const border = (k) => (shown(k) ? "border-[#d93f00]" : "border-black/15");
  const input = (k, props = {}) => (
    <input id={id(k)} name={k} value={fields[k]} onChange={set(k)} onBlur={blur(k)} aria-invalid={!!shown(k)} aria-describedby={`${id(k)}-error`} className={`${fieldCls} ${border(k)}`} {...props} />
  );

  // (what the backend gets: the form's own fields, and a readable summary)
  const payload = () => {
    const f = fields;
    const details = [
      `Industry: ${f.industry.trim()}`,
      `Website type: ${f.siteType}`,
      `Go live: ${f.goLive}`,
      f.currentUrl.trim() && `Current website: ${f.currentUrl.trim()}`,
      f.phone.trim() && `Phone: ${f.phone.trim()}`,
      `Heard about us: ${f.heardFrom}`,
    ]
      .filter(Boolean)
      .join("\n");
    return { ...f, name: f.fullName.trim(), email: f.email.trim(), company: f.company.trim(), projectType: f.siteType, details, pageURL: window.location.href };
  };

  async function onSubmit(e) {
    e.preventDefault();
    if (sending) return;
    const errs = validate(fields);
    setErrors(errs);
    setTouched(Object.fromEntries(ORDER.map((k) => [k, true])));
    if (Object.keys(errs).length) {
      const first = ORDER.find((k) => errs[k]);
      formRef.current?.querySelector(`#${CSS.escape(id(first))}`)?.focus();
      return;
    }
    setStatus({ kind: "sending" });
    const body = payload();
    const res = await submitContact(body);
    if (res.ok) {
      setStatus({ kind: "sent", name: body.name.split(/\s+/)[0] });
      setFields(EMPTY);
      setTouched({});
      setErrors({});
    } else {
      setStatus({ kind: "error", reason: res.reason, mailto: mailtoFor(body) });
    }
  }

  if (status.kind === "sent") {
    return (
      <div role="status" className="flex min-h-[28rem] flex-col justify-center gap-[1vw] max-md:gap-4">
        <p className="text-[3vw] leading-[1.1] tracking-[-0.02em] max-md:text-[8vw]">Thank you{status.name ? `, ${status.name}` : ""}.</p>
        <p className="max-w-[32vw] text-[#595959] max-md:max-w-full">We read every message ourselves and will reply within two working days.</p>
        <button type="button" onClick={() => setStatus({ kind: "idle" })} className="mt-[1.5vw] w-fit underline underline-offset-4 hover:text-[#ff5f00] focus-visible:text-[#ff5f00] focus-visible:outline-none max-md:mt-4">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-[2.5vw] max-md:mt-[5vw] max-md:gap-[7vw]">
      <div className="flex w-full flex-col gap-[2vw] max-md:gap-[7vw]">
        <Step>01 | About your project</Step>
        <div className="flex w-full flex-col gap-[1vw] max-md:gap-[6vw]">
          <Row id={id("industry")} question="Which industry do you work in?*" error={shown("industry")}>
            {input("industry", { placeholder: "Industry*", autoComplete: "off" })}
          </Row>
          <Row id={id("siteType")} question="What website type do you need?*" error={shown("siteType")}>
            <Select id={id("siteType")} value={fields.siteType} onChange={set("siteType")} onBlur={blur("siteType")} options={SITE_TYPES} invalid={!!shown("siteType")} />
          </Row>
          <Row id={id("goLive")} question="When do you want to go live?*" error={shown("goLive")}>
            {input("goLive", { type: "date", className: `${fieldCls} ${border("goLive")} ${fields.goLive ? "" : "text-[#595959]"}` })}
          </Row>
          <Row id={id("currentUrl")} question="Link to your current website" error={shown("currentUrl")}>
            {input("currentUrl", { placeholder: "URL (optional)", inputMode: "url", autoComplete: "url" })}
          </Row>
        </div>
      </div>

      <Rule />

      <div className="flex w-full flex-col gap-[2vw] max-md:gap-[7vw]">
        <Step>02 | About yourself</Step>
        <div className="flex w-full flex-col gap-[1vw] max-md:gap-[6vw]">
          <Row id={id("fullName")} question="What's your name?*" error={shown("fullName")}>
            {input("fullName", { placeholder: "Your name*", autoComplete: "name" })}
          </Row>
          <Row id={id("company")} question="Name of your company?*" error={shown("company")}>
            {input("company", { placeholder: "Company*", autoComplete: "organization" })}
          </Row>
          <Row id={id("email")} question="What's your mail?*" error={shown("email")}>
            {input("email", { placeholder: "Email*", type: "email", inputMode: "email", autoComplete: "email" })}
          </Row>
          <Row id={id("phone")} question="What's your phone number?" error={shown("phone")}>
            {input("phone", { placeholder: "Phone", type: "tel", inputMode: "tel", autoComplete: "tel" })}
          </Row>
        </div>
      </div>

      <Rule />

      <div className="flex w-full flex-col gap-[2vw] max-md:gap-[7vw]">
        <Step>03 | We appreciate your feedback</Step>
        <Row id={id("heardFrom")} question="How did you learn about us?*" error={shown("heardFrom")}>
          <Select id={id("heardFrom")} value={fields.heardFrom} onChange={set("heardFrom")} onBlur={blur("heardFrom")} options={HEARD_FROM} invalid={!!shown("heardFrom")} />
        </Row>
      </div>

      <Rule />

      <div>
        <label htmlFor={id("terms")} className="flex w-full cursor-pointer items-start gap-[1vw] max-md:gap-[3vw]">
          <input
            id={id("terms")}
            type="checkbox"
            checked={fields.terms}
            onChange={set("terms")}
            aria-invalid={!!shown("terms")}
            aria-describedby={`${id("terms")}-error`}
            className={`mt-[0.15vw] h-[1.5vw] min-h-4 w-[1.5vw] min-w-4 shrink-0 cursor-pointer appearance-none rounded-[0.4vw] border bg-white bg-center bg-no-repeat transition-colors checked:border-[#111111] checked:bg-[#111111] checked:bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.6l4.5-5' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5f00] max-md:mt-[1vw] max-md:rounded-[0.8vw] ${shown("terms") ? "border-[#d93f00]" : "border-black/15"}`}
          />
          <span>I agree to the processing of my personal data in accordance with the Privacy Policy.</span>
        </label>
        <p id={`${id("terms")}-error`} aria-live="polite" className={`mt-[0.4vw] text-[0.9vw] text-[#d93f00] max-md:text-[3.2vw] ${shown("terms") ? "" : "hidden"}`}>
          {shown("terms") || ""}
        </p>
      </div>

      <Rule />

      <div className="flex flex-col gap-[1vw] max-md:gap-4">
        {status.kind === "error" && (
          <p role="alert" className="max-w-[36vw] text-[#595959] max-md:max-w-full">
            {status.reason === "not-configured" ? "Our form can't send messages just yet. " : "Something went wrong sending that. "}
            <a href={status.mailto} className="text-[#d93f00] underline underline-offset-4">
              Email it to {CONTACT_EMAIL}
            </a>{" "}
            instead. Your message is already written into it.
          </p>
        )}
        <PillButton type="submit" disabled={sending} busy={sending}>
          {sending ? "Sending…" : "Submit"}
        </PillButton>
      </div>
    </form>
  );
}
