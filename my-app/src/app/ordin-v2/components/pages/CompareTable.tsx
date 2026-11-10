// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { useReveal } from "../Animations/useReveal";
import LineReveal from "../Animations/LineReveal";
import { HX_LIGHT_PRIMARY } from "../hxPalette";
import { ThemedDataTable } from "../effects/animated-data-table";
import { COMPARE } from "./content";
import { useIsMobile } from "../Animations/useIsMobile";

const COLUMNS = [
  { key: "feature", header: "", className: "w-[34%]" },
  ...COMPARE.plans.map((plan) => ({ key: plan, header: plan })),
];

const ROWS = COMPARE.rows.map((row, i) => ({
  id: String(i),
  feature: row.label,
  ...Object.fromEntries(COMPARE.plans.map((plan, p) => [plan, row.values[p]])),
}));

// Phones show one plan at a time next to the features, picked with the switch above the table
const columnsFor = (plan: string) => [
  { key: "feature", header: "", className: "w-[56%]" },
  { key: plan, header: plan },
];

// Light section: every plan side by side in the Hyperiux Animated Data Table, with only its
// hover on: a highlight that slides from row to row under the cursor
const CompareTable = () => {
  const root = useRef<HTMLElement>(null);
  useReveal(root);
  const mobile = useIsMobile();
  const [plan, setPlan] = useState(COMPARE.plans[1]);

  return (
    <section ref={root} data-ord-orb="pricing-compare" data-ord-chapter="Compare" data-ord-light className="relative bg-ord-bone text-ord-ink">
      <div className="flex flex-col gap-14 ord-container ord-section max-md:gap-8">
        <LineReveal className="w-[50%] max-lg:w-full">
          <h2>
            Compare <span className="text-ord-primary-deep">every plan.</span>
          </h2>
        </LineReveal>
        <div data-ord-reveal className="flex flex-col gap-6">
          {mobile && (
            <div role="group" aria-label="Plan to compare" className="flex gap-1 border border-(--ord-ink)/12 p-1">
              {COMPARE.plans.map((p) => {
                const active = p === plan;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPlan(p)}
                    className={`relative flex-1 cursor-pointer rounded-xs py-[1.4vh] text-22 transition-colors duration-500 ${
                      active ? "text-(--ord-on-primary)" : "text-(--ord-text-muted)"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="ord-compare-plan"
                        transition={{ type: "spring", visualDuration: 0.45, bounce: 0.12 }}
                        className="absolute inset-0 rounded-xs bg-(--ord-primary)"
                      />
                    )}
                    <span className="relative">{p}</span>
                  </button>
                );
              })}
            </div>
          )}
          <ThemedDataTable
            palette={HX_LIGHT_PRIMARY}
            mode="light"
            className="ord-fit-table text-22"
            columns={mobile ? columnsFor(plan) : COLUMNS}
            rows={ROWS}
            rowHighlight="slide"
            rowHighlightColor="primary"
            staggerRows={false}
            staggerCells={false}
            numberAnimation="off"
            sortable={false}
            showStatusFilter={false}
            showStatusBadges={false}
            expandable={false}
            addable={false}
            removable={false}
            selectable={false}
            loadingSkeleton={false}
            stickyHeader={false}
            height="auto"
            rounded="none"
            showVerticalLines={false}
          />
        </div>
      </div>
    </section>
  );
};

export default CompareTable;
