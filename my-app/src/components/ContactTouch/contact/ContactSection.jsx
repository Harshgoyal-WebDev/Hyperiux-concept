import Image from "next/image";
import ContactForm from "./ContactForm";
import Pill from "./Pill";
import { EMAIL } from "./send";

// The contact section, under the scene all along (the glass discs open onto
// it): two ways in, side by side on a light page — OPTION 1, a call, with the
// office (its address and a map); OPTION 2, the form. Hyperiux's details.

const PHONE = { label: "+91 8178 026 136", href: "tel:+918178026136" };
const ADDRESS = "Grandslam I-Thum, A-40, Sector- 62, Noida, Uttar Pradesh (201309)";
// (no booking link of Hyperiux's own yet: the call is asked for by email)
const BOOK_CALL = `mailto:${EMAIL}?subject=${encodeURIComponent("Book a discovery call")}`;
const underline =
  "w-fit bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 hover:bg-[length:100%_1px] focus-visible:bg-[length:100%_1px] focus-visible:outline-none";

function Office({ className = "" }) {
  return (
    <div className={`flex flex-col gap-[2vw] max-md:gap-6 ${className}`}>
      <h3 className="text-[3.4vw] leading-[1.1] tracking-[-0.02em] max-md:text-[9vw]">Our Office Location</h3>
      <address className="flex w-[60%] flex-col gap-[0.4vw] text-[1.1vw] font-medium not-italic max-md:w-full max-md:gap-1.5 max-md:text-[4.2vw]">
        <a href={`mailto:${EMAIL}`} className={underline}>
          {EMAIL}
        </a>
        <a href={PHONE.href} className={underline}>
          {PHONE.label}
        </a>
        <span>{ADDRESS}</span>
      </address>
      <div className="relative mt-[1vw] h-[50vh] w-full overflow-hidden rounded-[2vw] max-md:h-[55vh] max-md:rounded-[6vw]">
        <Image src="/assets/images/contact-map.webp" alt={`Map showing ${ADDRESS}`} fill sizes="(max-width: 768px) 90vw, 38vw" className="object-cover object-[45%_70%]" />
        {/* (the office on the map) */}
        <span aria-hidden className="absolute left-[41.5%] top-[77.8%] flex size-[2.6vw] min-h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#111111] shadow-[0_6px_18px_rgba(0,0,0,0.25)] ring-4 ring-[#ff5f00]/25">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG mark */}
          <img src="/hyperiux-icon-white.svg" alt="" className="h-[48%] w-auto" />
        </span>
      </div>
    </div>
  );
}

export default function ContactSection({ headingId }) {
  return (
    <div className="relative min-h-svh w-full bg-[#fefefe] px-[5vw] py-[7%] text-[1.15vw] text-[#1a1a1a] max-md:px-[7vw] max-md:py-[24%] max-md:text-[3.9vw]">
      <h2 id={headingId} tabIndex={-1} className="sr-only">
        Contact Hyperiux
      </h2>
      <div className="flex w-full justify-between max-md:flex-col max-md:gap-[18vw]">
        <div className="flex w-[42%] flex-col justify-between gap-[22vw] max-md:w-full max-md:gap-0">
          <div className="flex flex-col">
            <p className="font-medium max-md:mb-[4vw]">OPTION 1</p>
            <p className="text-center text-[7.5vw] leading-[1.05] tracking-[-0.03em] max-md:text-left max-md:text-[13vw]">Calendly</p>
            <div className="my-[1.5vw] h-px w-full bg-black/20 max-md:my-[5vw]" />
            <div className="flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-[6vw]">
              <p>100% free & non-binding</p>
              <Pill href={BOOK_CALL}>Book A Call</Pill>
            </div>
          </div>
          <Office className="w-[90%] max-md:hidden" />
        </div>
        <div className="w-[52.5%] max-md:w-full">
          <p className="font-medium max-md:mb-[4vw]">OPTION 2</p>
          <p className="pl-[5vw] text-[7.5vw] leading-[1.05] tracking-[-0.03em] max-md:pl-0 max-md:text-[13vw]">Form</p>
          <div className="my-[1.5vw] h-px w-full bg-black/20 max-md:my-[5vw]" />
          <ContactForm />
        </div>
        <Office className="hidden w-full max-md:flex" />
      </div>
    </div>
  );
}
