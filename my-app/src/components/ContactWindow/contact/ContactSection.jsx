import ContactForm from "./ContactForm";
import { CONTACT_EMAIL } from "./submitContact";

const YEAR = new Date().getFullYear();

// The contact page itself — plain HTML and CSS, the world on the other side
// of the portal. (It opens through the scene: scene/Reveal.jsx.)
const DETAILS = [
  { label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { label: "Phone", value: "+91 81780 26136", href: "tel:+918178026136" },
  { label: "Website", value: "www.hyperiux.com", href: "https://www.hyperiux.com", external: true },
];

export default function ContactSection({ headingId }) {
  return (
    <div className="relative isolate min-h-[100svh] overflow-hidden bg-[#050505] px-[6vw] pb-[10vh] pt-[18vh] text-[#f1f1f1] max-md:px-6 max-md:pt-[14vh]">
      {/* the portal's light, still falling in from where it opened */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="nc-in absolute left-1/2 top-[-38vmax] h-[76vmax] w-[76vmax] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,95,0,0.16)_0%,rgba(255,95,0,0.05)_38%,transparent_68%)]" />
        <div className="nc-in absolute left-1/2 top-[-30vmax] h-[60vmax] w-[60vmax] -translate-x-1/2 rounded-full border border-[#ff5f00]/15" />
      </div>

      <div className="mx-auto grid max-w-[92rem] gap-x-[8vw] gap-y-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col">
          <p className="nc-in mb-10 flex items-center gap-4 text-[0.7rem] uppercase tracking-[0.3em] text-[#ff5f00]" style={{ "--d": 0 }}>
            <span aria-hidden className="h-px w-10 bg-[#ff5f00]" />
            07 — Contact
          </p>
          <h1 id={headingId} tabIndex={-1} className="outline-none text-[clamp(3rem,7.4vw,8.2rem)] font-medium uppercase leading-[0.88] tracking-[-0.045em]">
            <span className="nc-line block">
              <span style={{ "--d": 1 }}>Let&rsquo;s get</span>
            </span>
            <span className="nc-line block">
              <span style={{ "--d": 2 }}>
                in touch<span className="text-[#ff5f00]">.</span>
              </span>
            </span>
          </h1>
          <div className="nc-in mt-10 max-w-[30rem] space-y-1 text-[1.05rem] leading-relaxed text-[#f1f1f1]/60" style={{ "--d": 3 }}>
            <p>Have an idea, a project, or just want to say hello?</p>
            <p className="text-[#f1f1f1]/85">Let&rsquo;s build something extraordinary.</p>
          </div>

          <dl className="nc-in mt-14 max-w-[30rem] border-t border-[#f1f1f1]/12 lg:mt-auto lg:pt-0" style={{ "--d": 6 }}>
            {DETAILS.map((d, i) => (
              <div key={d.label} className="nc-in flex items-baseline justify-between gap-6 border-b border-[#f1f1f1]/12 py-5" style={{ "--d": 6 + i }}>
                <dt className="text-[0.68rem] uppercase tracking-[0.24em] text-[#f1f1f1]/40">{d.label}</dt>
                <dd>
                  <a
                    href={d.href}
                    {...(d.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="group inline-flex items-center gap-2 text-[1rem] text-[#f1f1f1] transition-colors hover:text-[#ff5f00] focus-visible:text-[#ff5f00] focus-visible:outline-none"
                  >
                    <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">{d.value}</span>
                    <span aria-hidden className="text-[0.8em] opacity-50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100">
                      ↗
                    </span>
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:pt-[3.4rem]">
          <p className="nc-in mb-12 max-w-[34rem] text-[0.95rem] leading-relaxed text-[#f1f1f1]/50" style={{ "--d": 4 }}>
            Tell us what you have in mind. A few lines are plenty; we&rsquo;ll take it from there.
          </p>
          <div className="nc-in" style={{ "--d": 5 }}>
            <ContactForm />
          </div>
        </div>
      </div>

      <footer style={{ "--d": 9 }} className="nc-in mx-auto mt-[14vh] flex max-w-[92rem] flex-wrap items-center justify-between gap-4 border-t border-[#f1f1f1]/10 pt-6 text-[0.7rem] uppercase tracking-[0.22em] text-[#f1f1f1]/35">
        <span>Hyperiux — Digital Experience Design</span>
        <span>© {YEAR}</span>
      </footer>
    </div>
  );
}
