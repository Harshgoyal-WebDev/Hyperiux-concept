"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import Blogs from "./Home/BlogActive";
import ClientsGrid from "./Home/ClientsGrid";
import Industries from "./Home/Industries";
import NewFaq from "./Home/NewFaq";
import SectionBreak from "./Home/SectionBreak";
import Solutions from "./Home/Solution/Solutions";
import Testimonial from "./Home/Testimonials/Testimonial";
import WorkWithContent from "./Home/Work/WorkWithContent";
import WorkMobile from "./Home/Work/WorkMobile";

// The Hyperiux homepage, from Work to the FAQ (as on hyperiux-staging),
// where the journey comes out of the garden's light. The blogs use their
// own sample posts (the site reads them from Sanity).
export default function HomeSections() {
  // Mounted below the journey once the garden is reached, so the page grows
  // by the whole site: the smooth scroll must measure it again (or it stays
  // capped at the journey's end), and again as the sections settle (images,
  // fonts, their own pinned scenes).
  const root = useRef(null);
  const lenis = useLenis();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        lenis?.resize();
        ScrollTrigger.refresh();
      });
    };
    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [lenis]);

  return (
    <div ref={root} data-white-site data-hyperiux-home className="relative z-10  text-[#111] mt-[-100vh]">
      {/* (the ids are the footer's links: SiteFooter scrolls to them) */}
      <div id="work">
        <WorkWithContent />
        <WorkMobile />
      </div>
      {/* <SectionBreak /> */}
      <div id="expertise">
        <Solutions />
      </div>
      <div id="industries">
        <Industries />
      </div>
      <div id="clients">
        <ClientsGrid />
      </div>
      <div id="testimonials">
        <Testimonial />
      </div>
      <div id="resources">
        <Blogs />
      </div>
      <div id="faq">
        <NewFaq content={faqContent} />
      </div>
    </div>
  );
}

const faqContent = [
  {
    question: "What is UX design, and why is it important for my website?",
    answer:
      "Choosing a UI UX design agency in India offers quality services at competitive pricing. We bring UX expertise combined with local market understanding, helping you achieve outstanding results.",
  },
  {
    question: "Why should I choose a UI UX design agency in India?",
    answer:
      "Yes, we provide UX design solutions tailored for both startups and large enterprises. Whether you’re launching a new product or enhancing an existing one, our team delivers innovative and scalable designs.",
  },
  {
    question: "Do you offer UX design services for startups and enterprises?",
    answer:
      "We follow a proven UX process: research, strategy, design, prototyping, and testing. Our team uses industry best practices and innovative tools to ensure every solution is user-centric and effective.",
  },
  {
    question: "How does Enigma Digital ensure high-quality UX design?",
    answer:
      "If your website feels outdated or struggles to convert users, we can help you with UX redesign services that improve usability, aesthetics, and business performance.",
  },
  {
    question: "Can you help with website UX redesign?",
    answer:
      "Absolutely. We design seamless user experiences for mobile apps, SaaS platforms, and e-commerce websites, helping businesses engage users and increase sales.",
  },
  {
    question: "Do you offer UI UX design for mobile apps and e-commerce platforms?",
    answer:
      "UI UX design costs vary based on project size, complexity, and scope. Enigma Digital offers affordable pricing tailored to your business needs. Contact us for a customised quote.",
  },
  {
    question: "How much do UI UX design services cost?",
    answer:
      "Yes, we offer comprehensive UX audits to identify usability issues and recommend improvements, helping businesses enhance their digital experiences.",
  },
  {
    question: "Does Hyperiux provide UX audits?",
    answer:
      "Hyperiux is a full-service UX/UI design company. We combine beautiful user interfaces (UI) with seamless user experiences (UX) to deliver exceptional digital products.",
  },
  {
    question: "Is Hyperiux a UX/UI design company or purely UX-focused?",
    answer:
      "Hyperiux is a leading UI/UX design agency with its head office in Noida, India. It specializes in user-centric UI/UX design services for business and consumer applications across multiple countries, including the USA, Canada, the Middle East, India, and beyond.",
  },
];
