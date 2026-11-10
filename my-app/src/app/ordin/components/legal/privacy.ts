// Built using Hyperiux Vault: https://vault.hyperiux.com

import type { Block } from "../blog/posts";

// Sample policy text for a fictional company. It is a starting point, not legal advice:
// have it reviewed for your own product, data and jurisdictions before you publish.

export const PRIVACY_UPDATED = "2026-11-01";

export const PRIVACY: Block[] = [
  {
    type: "lead",
    text: "This policy explains what Ordin Labs collects when you use the Ordin website and platform, why we collect it, and the choices you have. We have tried to write it the way we write everything else: plainly.",
  },
  {
    type: "callout",
    title: "Template copy",
    text: "This page is sample text for a fictional company. Replace it with a policy reviewed for your own product before you launch.",
  },
  { type: "h2", id: "who-we-are", text: "Who we are" },
  {
    type: "p",
    text: "Ordin Labs operates the Ordin platform and this website. For the personal data described here, Ordin Labs is the controller. When you run agents on Ordin with your own customers' data, you are the controller of that data and we process it on your behalf under our data processing agreement.",
  },
  { type: "h2", id: "what-we-collect", text: "What we collect" },
  {
    type: "list",
    items: [
      "Account details: your name, work email, company and role when you sign up or contact us",
      "Billing details: handled by our payment provider; we keep only the last four digits and the billing address",
      "Usage data: pages viewed, features used, device and browser type, and approximate location from your IP address",
      "Run data: the jobs, prompts, tool calls, outputs and traces your agents create on the platform",
      "Support data: messages you send us and the context you choose to attach",
    ],
  },
  { type: "h2", id: "how-we-use-it", text: "How we use it" },
  {
    type: "p",
    text: "We use your data to provide and secure the platform, bill you correctly, answer your questions, and improve the product. We rely on our contract with you for the first three, and on our legitimate interest in a reliable, secure service for the rest.",
  },
  {
    type: "list",
    ordered: true,
    items: [
      "Running, retrying and replaying the jobs you start",
      "Detecting abuse, fraud and security incidents",
      "Sending service messages such as invoices and incident notices",
      "Sending product news, only if you opt in, with an unsubscribe link in every email",
    ],
  },
  { type: "h2", id: "run-data", text: "Your run data stays yours" },
  {
    type: "p",
    text: "Run data belongs to you. We do not use it to train models, we do not sell it, and our staff can only open a trace when you grant access for a support request. Model providers you connect receive only what a step sends them, under their own terms.",
  },
  {
    type: "callout",
    title: "Data residency",
    text: "Enterprise workspaces can pin run data to a single region, or run the whole runtime inside your own cloud account.",
  },
  { type: "h2", id: "sharing", text: "Who we share it with" },
  {
    type: "p",
    text: "We share data only with the providers that help us run Ordin, such as cloud hosting, payments, email and error monitoring, each under a contract that limits use to the service they provide. We disclose data to authorities only when the law requires it, and we tell you first where we are allowed to.",
  },
  { type: "h2", id: "retention", text: "How long we keep it" },
  {
    type: "list",
    items: [
      "Account data: for as long as your account is open, then 30 days",
      "Run traces: for your plan's replay window (7 or 90 days, or as configured on Enterprise)",
      "Billing records: as long as tax law requires, usually seven years",
      "Website analytics: 14 months, in aggregate",
    ],
  },
  { type: "h2", id: "security", text: "How we protect it" },
  {
    type: "p",
    text: "Data is encrypted in transit and at rest. Access is scoped, logged and reviewed, credentials given to agents are short-lived, and every action an agent takes is written to the audit trail. We test our controls with independent auditors every year.",
  },
  { type: "h2", id: "your-rights", text: "Your rights" },
  {
    type: "p",
    text: "Depending on where you live, you can ask to see, correct, export or delete your personal data, object to how we use it, or withdraw consent you gave. Write to us and we will answer within 30 days. You can also complain to your local data protection authority.",
  },
  { type: "h2", id: "cookies", text: "Cookies" },
  {
    type: "p",
    text: "We use essential cookies to keep you signed in and to protect forms. With your consent, we also use analytics cookies to understand which pages help. You can change your choice at any time from the cookie settings link in the footer.",
  },
  { type: "h2", id: "changes", text: "Changes to this policy" },
  {
    type: "p",
    text: "When we change this policy we update the date at the top. For changes that matter, we email account owners at least 30 days before they take effect.",
  },
  { type: "h2", id: "contact", text: "Contact us" },
  {
    type: "p",
    text: "Questions about privacy go to privacy@ordin.example, or by post to Ordin Labs, 100 Example Street, London. Our data protection officer reads every message.",
  },
];
