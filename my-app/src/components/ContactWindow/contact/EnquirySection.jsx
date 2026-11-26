import Image from "next/image";
import EnquiryForm from "./EnquiryForm";
import PillButton from "./PillButton";
import { CONTACT_EMAIL } from "./submitContact";

// The contact page under the portal (after weareenigma-next's /contact-us
// "contact-form" section): two ways in, side by side on a light page —
// OPTION 1, a call (with the office: its address and a map), and OPTION 2,
// the form. Hyperiux's own details throughout. Its pieces come in, one after
// another, once the portal has opened right across (ContactWindow.jsx:
// [data-revealed] .nc-in / .nc-line, --d their turn).

const PHONE = { label: "+91 8178 026 136", href: "tel:+918178026136" };
const ADDRESS = "Grandslam I-Thum, A-40, Sector- 62, Noida, Uttar Pradesh (201309)";
// (no booking link of Hyperiux's own yet: the call is asked for by email)
const BOOK_CALL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Book a discovery call")}`;

function Office({ className = "" }) {
  return (
    <div className={`flex flex-col gap-[2vw] max-md:gap-6 ${className}`}>
      <h3 className="nc-line text-[3.4vw] leading-[1.1] tracking-[-0.02em] max-md:text-[9vw]">
        <span style={{ "--d": 5 }}>Our Office Location</span>
      </h3>
      <address className="nc-in flex w-[60%] flex-col gap-[0.4vw] text-[1.1vw] font-medium not-italic max-md:w-full max-md:gap-1.5 max-md:text-[4.2vw]" style={{ "--d": 6 }}>
        <a href={`mailto:${CONTACT_EMAIL}`} className="w-fit bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 hover:bg-[length:100%_1px] focus-visible:bg-[length:100%_1px] focus-visible:outline-none">
          {CONTACT_EMAIL}
        </a>
        <a href={PHONE.href} className="w-fit bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 hover:bg-[length:100%_1px] focus-visible:bg-[length:100%_1px] focus-visible:outline-none">
          {PHONE.label}
        </a>
        <span>{ADDRESS}</span>
      </address>
      {/* (the office on the map: Grandslam I-Thum, Sector 62, Noida) */}
      <div className="nc-in relative mt-[1vw] h-[50vh] w-full overflow-hidden rounded-[2vw] max-md:h-[55vh] max-md:rounded-[6vw]" style={{ "--d": 7 }}>
        <Image src="/assets/images/contact-map.webp" alt={`Map: ${ADDRESS}`} fill sizes="(max-width: 768px) 90vw, 38vw" className="object-cover object-[45%_70%]" />
        <span aria-hidden className="absolute left-[41.5%] top-[77.8%] flex h-[2.6vw] min-h-9 w-[2.6vw] min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.25)] ring-4 ring-[#ff5f00]/25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hyperiux-icon-white.svg" alt="" className="h-[48%] w-auto" />
        </span>
      </div>
    </div>
  );
}

export default function EnquirySection({ headingId }) {
  return (
    <div className="relative min-h-[100svh] w-full bg-[#fefefe] px-[5vw] py-[7%] text-[1.15vw] text-[#1a1a1a] max-md:px-[7vw] max-md:py-[18%] max-md:text-[3.9vw]">
      {/* (the page's heading, for the "skip to contact" focus and the landmark) */}
      <h1 id={headingId} tabIndex={-1} className="sr-only">
        Contact Hyperiux
      </h1>
      <div className="flex w-full justify-between max-md:flex-col max-md:gap-[20vw]">
        {/* OPTION 1 — a call, and where we are */}
        <div className="flex w-[42%] flex-col justify-between gap-[22vw] max-md:w-full max-md:gap-0">
          <div className="flex w-full flex-col">
            <p className="nc-in font-medium max-md:mb-[5vw]" style={{ "--d": 0 }}>
              OPTION 1
            </p>
            <h2 className="nc-line text-center text-[7.5vw] leading-[1.05] tracking-[-0.03em] max-md:text-left max-md:text-[13vw]">
              <span style={{ "--d": 1 }}>Calendly</span>
            </h2>
            <div className="nc-in my-[1.5vw] h-px w-full bg-black/20 max-md:my-[5vw]" style={{ "--d": 2 }} />
            <div className="nc-in flex w-full items-center justify-between max-md:flex-col max-md:items-start max-md:gap-[6vw]" style={{ "--d": 3 }}>
              <p>100% free & non-binding</p>
              <PillButton href={BOOK_CALL}>Book A Call</PillButton>
            </div>
          </div>
          <Office className="w-[90%] max-md:hidden" />
        </div>

        {/* OPTION 2 — the form */}
        <div className="w-[52.5%] max-md:w-full">
          <div className="flex w-full flex-col">
            <p className="nc-in font-medium max-md:mb-[5vw]" style={{ "--d": 1 }}>
              OPTION 2
            </p>
            <h2 className="nc-line pl-[5vw] text-[7.5vw] leading-[1.05] tracking-[-0.03em] max-md:pl-0 max-md:text-[13vw]">
              <span style={{ "--d": 2 }}>Form</span>
            </h2>
            <div className="nc-in my-[1.5vw] h-px w-full bg-black/20 max-md:my-[5vw]" style={{ "--d": 3 }} />
            <div className="nc-in" style={{ "--d": 4 }}>
              <EnquiryForm />
            </div>
          </div>
        </div>

        <Office className="hidden w-full max-md:flex" />
      </div>
    </div>
  );
}
