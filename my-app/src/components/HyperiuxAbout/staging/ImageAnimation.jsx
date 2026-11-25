"use client";

// hyperiux-staging/src/components/About/ImageAnimation.jsx — the award
// image trail that follows the cursor while it is over the Awards section
// (desktop only). Same behaviour; the handlers live inside the effect.

import React, { useEffect, useRef } from "react";
import gsap from "gsap";

const MathUtils = {
  lerp: (a, b, n) => (1 - n) * a + n * b,
  distance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
};

const TOTAL_IMAGES = 7;
const TRAIL_LENGTH = 100;
const THRESHOLD = 80;

export default function ImagesAnimation({ awardsRef }) {
  const imagesRef = useRef([]);

  useEffect(() => {
    const images = imagesRef.current;
    const mousePos = { x: 0, y: 0 };
    let lastMousePos = { x: 0, y: 0 };
    const cacheMousePos = { x: 0, y: 0 };
    let zIndexVal = 1;
    let imgPosition = 0;
    let isInsideAwards = false;
    let hasMouseMoved = false;
    let rafId = 0;

    const handleMouseMove = (event) => {
      const awardsEl = awardsRef?.current;
      if (!awardsEl) return;

      const rect = awardsEl.getBoundingClientRect();

      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      isInsideAwards = inside;

      if (!inside) return;

      mousePos.x = event.clientX;
      mousePos.y = event.clientY;

      if (!hasMouseMoved) {
        hasMouseMoved = true;
        lastMousePos = { ...mousePos };
        cacheMousePos.x = mousePos.x;
        cacheMousePos.y = mousePos.y;
      }
    };

    const showNextImage = () => {
      const img = images[imgPosition];
      if (!img) return;

      const width = img.offsetWidth || window.innerWidth * 0.17;
      const height = img.offsetHeight || window.innerHeight * 0.3;

      gsap.killTweensOf(img);

      gsap
        .timeline()
        .set(img, {
          opacity: 1,
          scale: 0.2,
          rotateZ: gsap.utils.random(-35, 35),
          zIndex: 9999 + zIndexVal,
          x: cacheMousePos.x - width / 2,
          y: cacheMousePos.y - height / 2,
        })
        .to(img, {
          ease: "expo.out",
          rotateZ: 0,
          opacity: 1,
          scale: 1,
          duration: 0.85,
          x: mousePos.x - width / 2,
          y: mousePos.y - height / 2,
        })
        .to(
          img,
          {
            ease: "power4.inOut",
            opacity: 0,
            rotateZ: gsap.utils.random(-15, 15),
            duration: 0.65,
            scale: 0,
          },
          "-=0.45",
        );
    };

    const render = () => {
      cacheMousePos.x = MathUtils.lerp(cacheMousePos.x, mousePos.x, 0.12);
      cacheMousePos.y = MathUtils.lerp(cacheMousePos.y, mousePos.y, 0.12);

      const distance = MathUtils.distance(mousePos.x, mousePos.y, lastMousePos.x, lastMousePos.y);

      if (hasMouseMoved && isInsideAwards && distance > THRESHOLD) {
        showNextImage();

        zIndexVal += 1;
        imgPosition = (imgPosition + 1) % images.length;

        lastMousePos = { ...mousePos };
      }

      rafId = requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
      images.forEach((img) => {
        if (img) gsap.killTweensOf(img);
      });
    };
  }, [awardsRef]);

  return (
    <div
      className="fixed inset-0 z-[9998] pointer-events-none overflow-visible max-sm:hidden"
      aria-hidden="true"
    >
      {Array.from({ length: TRAIL_LENGTH }, (_, index) => {
        const imgIndex = (index % TOTAL_IMAGES) + 1;

        return (
          // (a hundred absolutely transformed trail sprites, as on staging:
          // plain <img>, not next/image)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            ref={(el) => {
              if (el) imagesRef.current[index] = el;
            }}
            src={`/assets/images/aboutpage/award-${imgIndex}.webp`}
            alt=""
            draggable={false}
            className="content__img fixed top-0 left-0 !w-[17vw] !h-[30vh] rounded-[0.7vw] !object-contain"
            style={{
              opacity: 0,
              pointerEvents: "none",
              willChange: "transform, opacity",
              transform: "translate3d(0,0,0) scale(0)",
            }}
          />
        );
      })}
    </div>
  );
}
