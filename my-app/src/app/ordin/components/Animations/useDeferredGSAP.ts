// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Below-the-fold sections build their timelines, scroll triggers and text splits here instead of in useGSAP
// directly. React runs every component's effects in one task when the page hydrates, so building every
// section at once blocked the main thread for over a second on a mid-range phone. The setups now run one per
// task, in page order, with the browser free to paint and respond in between; the scroll triggers are
// refreshed once the queue is empty. Nothing below the fold is visible during that window (the intro loader
// holds the page at the top), so the order on screen is unchanged.

type Job = { run: () => void; cancelled: boolean };
type Setup = () => void | (() => void);
type Config = { scope?: RefObject<Element | null>; dependencies?: unknown[]; revertOnUpdate?: boolean };

const queue: Job[] = [];
let draining = false;

// A fresh task: scheduler.yield where supported (it resumes ahead of other queued work), a timeout otherwise
export function nextTask() {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return s?.yield ? s.yield() : new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function drain() {
  draining = true;
  let ran = false;
  while (queue.length) {
    await nextTask();
    const job = queue.shift();
    if (!job || job.cancelled) continue;
    job.run();
    ran = true;
  }
  draining = false;
  if (ran) ScrollTrigger.refresh();
}

export function useDeferredGSAP(setup: Setup, config: Config = {}) {
  useGSAP(() => {
    let ctx: gsap.Context | undefined;
    const job: Job = {
      cancelled: false,
      run: () => {
        ctx = gsap.context(setup, config.scope?.current ?? undefined);
      },
    };
    queue.push(job);
    if (!draining) void drain();
    return () => {
      job.cancelled = true;
      ctx?.revert();
    };
  }, config);
}
