"use client";

import { useId, useRef, useState } from "react";
import Pill from "./Pill";
import { EMAIL, sendEnquiry } from "./send";

// The enquiry form, in three parts — the project, the person, how they heard
// of us — then the privacy agreement. Each question on the left, its field on
// the right. A field is checked once it has been left, and all of them on
// sending; the first that needs attention takes the focus.

const SITE_TYPES = ["Marketing", "E-commerce", "SaaS", "Portfolio", "Blog", "Web App"];
const HEARD = ["Search", "Social", "Referral", "Advertisement", "Other"];
const FIELDS = ["industry", "siteType", "goLive", "website", "name", "company", "email", "phone", "heard", "agree"];
const EMPTY = { industry: "", siteType: "", goLive: "", website: "", name: "", company: "", email: "", phone: "", heard: "", agree: false };

function check(f) {
  const e = {};
  if (f.industry.trim().length < 2) e.industry = "Industry is required.";
  if (!f.siteType) e.siteType = "Please select a website type.";
  if (!f.goLive) e.goLive = "Please enter a target date.";
  if (f.website.trim() && !/^https?:\/\/\S+\.\S+/i.test(f.website.trim())) e.website = "Please enter a full URL (with http/https), or leave it blank.";
  if (f.name.trim().length < 2) e.name = "Your name is required.";
  if (f.company.trim().length < 2) e.company = "Company name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Please enter a valid email address.";
  if (f.phone.trim() && f.phone.replace(/\D/g, "").length < 10) e.phone = "Please enter a full phone number (10 digits or more).";
  if (!f.heard) e.heard = "Please tell us how you heard about us.";
  if (!f.agree) e.agree = "Please agree to the privacy policy.";
  return e;
}

const box =
  "h-[3.5vw] min-h-11 w-full rounded-[1vw] border bg-white px-[1.2vw] text-[1.1vw] text-[#1a1a1a] outline-none transition-colors placeholder:text-[#595959] focus:border-[#111111] max-md:rounded-[2.5vw] max-md:px-[4vw] max-md:text-base";

function Row({ id, label, error, children }) {
  return (
    <div className="flex w-full justify-between max-md:flex-col max-md:gap-[3vw]">
      <label htmlFor={id} className="w-[45%] pt-[1vw] max-md:w-full max-md:pt-0">
        {label}
      </label>
      <div className="w-[55%] max-md:w-full">
        {children}
        {error && (
          <p id={`${id}-err`} className="mt-[0.4vw] text-[0.9vw] text-[#c63a00] max-md:mt-1.5 max-md:text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

const Part = ({ title, children, d = 0 }) => (
  <div style={{ "--d": d }} className="ct-in flex w-full flex-col gap-[2vw] max-md:gap-[7vw]">
    <h3 className="text-[1.8vw] leading-tight max-md:text-[5.4vw]">{title}</h3>
    <div className="flex w-full flex-col gap-[1vw] max-md:gap-[6vw]">{children}</div>
  </div>
);
const Rule = () => <div className="h-px w-full bg-black/20" />;

export default function ContactForm() {
  const uid = useId();
  const id = (k) => `${uid}-${k}`;
  const form = useRef(null);
  const [f, setF] = useState(EMPTY);
  const [seen, setSeen] = useState({});
  const [state, setState] = useState({ kind: "idle" });
  const errors = check(f);
  const err = (k) => (seen[k] ? errors[k] : undefined);

  const change = (k) => (e) => {
    setF((v) => ({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
    if (k === "agree") setSeen((s) => ({ ...s, agree: true }));
    if (state.kind === "error") setState({ kind: "idle" });
  };
  const leave = (k) => () => setSeen((s) => ({ ...s, [k]: true }));
  const field = (k) => ({
    id: id(k),
    name: k,
    value: f[k],
    onChange: change(k),
    onBlur: leave(k),
    "aria-invalid": !!err(k),
    "aria-describedby": err(k) ? `${id(k)}-err` : undefined,
    className: `${box} ${err(k) ? "border-[#c63a00]" : "border-black/15"}`,
  });
  const select = (k, options) => (
    <div className="relative">
      <select {...field(k)} className={`${field(k).className} cursor-pointer appearance-none pr-[3vw] ${f[k] ? "" : "text-[#595959]"}`}>
        <option value="">Please Select</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 12 12" fill="none" className="pointer-events-none absolute right-[1.2vw] top-1/2 size-[0.8vw] min-h-2.5 min-w-2.5 -translate-y-1/2 text-[#595959] max-md:right-[4vw]">
        <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );

  async function submit(e) {
    e.preventDefault();
    if (state.kind === "sending") return;
    setSeen(Object.fromEntries(FIELDS.map((k) => [k, true])));
    const first = FIELDS.find((k) => errors[k]);
    if (first) {
      form.current?.querySelector(`#${CSS.escape(id(first))}`)?.focus();
      return;
    }
    setState({ kind: "sending" });
    const res = await sendEnquiry(f);
    if (res.ok) {
      setState({ kind: "sent", name: f.name.trim().split(/\s+/)[0] });
      setF(EMPTY);
      setSeen({});
    } else {
      setState({ kind: "error", mailto: res.mailto, configured: res.configured });
    }
  }

  if (state.kind === "sent") {
    return (
      <div role="status" className="flex min-h-[24rem] flex-col justify-center gap-[1vw] max-md:gap-4">
        <p className="text-[3vw] leading-[1.1] tracking-[-0.02em] max-md:text-[8vw]">Thank you, {state.name}.</p>
        <p className="text-[#595959]">We read every message ourselves and will reply within two working days.</p>
        <button type="button" onClick={() => setState({ kind: "idle" })} className="mt-[1vw] w-fit underline underline-offset-4 hover:text-[#ff5f00] focus-visible:text-[#ff5f00] focus-visible:outline-none">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form ref={form} noValidate onSubmit={submit} className="flex flex-col gap-[2.5vw] max-md:mt-[5vw] max-md:gap-[8vw]">
      <Part title="01 | About your project" d={3}>
        <Row id={id("industry")} label="Which industry do you work in?*" error={err("industry")}>
          <input {...field("industry")} placeholder="Industry*" autoComplete="off" />
        </Row>
        <Row id={id("siteType")} label="What website type do you need?*" error={err("siteType")}>
          {select("siteType", SITE_TYPES)}
        </Row>
        <Row id={id("goLive")} label="When do you want to go live?*" error={err("goLive")}>
          <input {...field("goLive")} type="date" className={`${field("goLive").className} ${f.goLive ? "" : "text-[#595959]"}`} />
        </Row>
        <Row id={id("website")} label="Link to your current website" error={err("website")}>
          <input {...field("website")} placeholder="URL (optional)" inputMode="url" autoComplete="url" />
        </Row>
      </Part>
      <Rule />
      <Part title="02 | About yourself" d={5}>
        <Row id={id("name")} label="What's your name?*" error={err("name")}>
          <input {...field("name")} placeholder="Your name*" autoComplete="name" />
        </Row>
        <Row id={id("company")} label="Name of your company?*" error={err("company")}>
          <input {...field("company")} placeholder="Company*" autoComplete="organization" />
        </Row>
        <Row id={id("email")} label="What's your email?*" error={err("email")}>
          <input {...field("email")} type="email" placeholder="Email*" inputMode="email" autoComplete="email" />
        </Row>
        <Row id={id("phone")} label="What's your phone number?" error={err("phone")}>
          <input {...field("phone")} type="tel" placeholder="Phone" inputMode="tel" autoComplete="tel" />
        </Row>
      </Part>
      <Rule />
      <Part title="03 | We appreciate your feedback" d={7}>
        <Row id={id("heard")} label="How did you learn about us?*" error={err("heard")}>
          {select("heard", HEARD)}
        </Row>
      </Part>
      <Rule />
      <div>
        <label htmlFor={id("agree")} className="flex cursor-pointer items-start gap-[1vw] max-md:gap-3">
          <input
            id={id("agree")}
            type="checkbox"
            checked={f.agree}
            onChange={change("agree")}
            aria-invalid={!!err("agree")}
            aria-describedby={err("agree") ? `${id("agree")}-err` : undefined}
            className={`mt-[0.15vw] size-[1.5vw] min-h-4 min-w-4 shrink-0 cursor-pointer appearance-none rounded-[0.4vw] border bg-white bg-center bg-no-repeat transition-colors checked:border-[#111111] checked:bg-[#111111] checked:bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.6l4.5-5' fill='none' stroke='white' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5f00] max-md:mt-0.5 ${err("agree") ? "border-[#c63a00]" : "border-black/15"}`}
          />
          <span>I agree to the processing of my personal data in accordance with the Privacy Policy.</span>
        </label>
        {err("agree") && (
          <p id={`${id("agree")}-err`} className="mt-[0.4vw] text-[0.9vw] text-[#c63a00] max-md:text-sm">
            {err("agree")}
          </p>
        )}
      </div>
      <Rule />
      <div className="flex flex-col gap-[1vw] max-md:gap-4">
        {state.kind === "error" && (
          <p role="alert" className="max-w-[36vw] text-[#595959] max-md:max-w-full">
            {state.configured ? "That didn't send. " : "Our form can't send messages just yet. "}
            <a href={state.mailto} className="text-[#c63a00] underline underline-offset-4">
              Email it to {EMAIL}
            </a>{" "}
            instead — your message is written into it.
          </p>
        )}
        <Pill type="submit" busy={state.kind === "sending"} disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Submit"}
        </Pill>
      </div>
    </form>
  );
}
