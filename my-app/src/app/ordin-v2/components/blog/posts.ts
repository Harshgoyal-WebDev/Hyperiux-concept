// Built using Hyperiux Vault: https://vault.hyperiux.com

// Every article on the blog. Add a post by adding an entry: the listing, the filters, the detail page,
// its table of contents and the related posts all read from here. Replace the sample copy with your own.

export type Block =
  | { type: "p"; text: string }
  | { type: "lead"; text: string }
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title: string; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "stats"; items: { value: string; label: string }[] };

export type Author = { name: string; role: string; initials: string };

// Picks the generated cover artwork (see PostCover.tsx)
export type CoverArt = "orbit" | "grid" | "wave" | "nodes" | "bars" | "rings";

export type Post = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  date: string; // ISO date, e.g. "2026-10-28"
  author: Author;
  cover: CoverArt;
  featured?: boolean;
  body: Block[];
};

const AUTHORS = {
  maya: { name: "Maya Okafor", role: "Head of Platform", initials: "MO" },
  arjun: { name: "Arjun Mehta", role: "Staff Engineer, Runtime", initials: "AM" },
  lena: { name: "Lena Brandt", role: "Product Lead, Governance", initials: "LB" },
} satisfies Record<string, Author>;

export const POSTS: Post[] = [
  {
    slug: "agents-need-a-runtime-not-a-prompt",
    title: "Agents need a runtime, not a longer prompt",
    summary:
      "Most agent failures in production are not model failures. They are missing retries, missing memory and missing limits. Here is what a runtime adds.",
    category: "Engineering",
    tags: ["Runtime", "Reliability", "Architecture"],
    date: "2026-10-28",
    author: AUTHORS.maya,
    cover: "orbit",
    featured: true,
    body: [
      {
        type: "lead",
        text: "When an agent works in a demo and fails in production, the usual fix is a longer prompt. It rarely helps, because the problem is almost never the wording.",
      },
      { type: "h2", id: "where-agents-break", text: "Where agents actually break" },
      {
        type: "p",
        text: "We reviewed four hundred failed runs from teams moving agents into production. Fewer than one in ten failed because the model reasoned badly. The rest failed around the model: a tool timed out and nothing retried it, a long job lost its context halfway through, or a step quietly spent far more than anyone expected.",
      },
      {
        type: "stats",
        items: [
          { value: "9%", label: "failures caused by model reasoning" },
          { value: "61%", label: "caused by tools, timeouts and retries" },
          { value: "30%", label: "caused by lost context or memory" },
        ],
      },
      { type: "h2", id: "what-a-runtime-adds", text: "What a runtime adds" },
      {
        type: "p",
        text: "A runtime treats each step of an agent's work as something durable. It is written down before it runs, retried when it fails, and resumed when the process restarts. The model still decides what to do. The runtime makes sure it gets done.",
      },
      {
        type: "list",
        items: [
          "Durable steps that survive restarts and deploys",
          "Retries with backoff for every tool call",
          "Memory scoped to the job, not the chat window",
          "Spend limits checked before the step, not after",
        ],
      },
      {
        type: "code",
        lang: "TypeScript",
        code: `const run = await ordin.run({
  job: "Reconcile Q3 invoices",
  agents: ["planner", "analyst", "courier"],
  budget: { usd: 5 },
  retries: { max: 3, backoff: "exponential" },
});`,
      },
      { type: "h2", id: "prompts-still-matter", text: "Prompts still matter, just less" },
      {
        type: "p",
        text: "Good instructions still make a difference. But once the runtime handles retries, memory and limits, a prompt can go back to describing the job instead of defending against every way the job could go wrong.",
      },
      {
        type: "quote",
        text: "We deleted two thirds of our system prompt the week we moved to a runtime. It had been doing a job it was never good at.",
        cite: "Platform lead, fintech customer",
      },
    ],
  },
  {
    slug: "policies-that-travel-with-the-action",
    title: "Policies that travel with the action",
    summary:
      "A rule written into a prompt can be talked around. A rule attached to the action itself cannot. How Ordin's policy engine decides every call.",
    category: "Governance",
    tags: ["Policies", "Security", "Compliance"],
    date: "2026-10-16",
    author: AUTHORS.lena,
    cover: "grid",
    body: [
      {
        type: "lead",
        text: "Telling an agent not to wire money is a suggestion. Making the wire call impossible without a sign-off is a policy.",
      },
      { type: "h2", id: "prompt-rules-leak", text: "Why prompt rules leak" },
      {
        type: "p",
        text: "A rule in a prompt competes with everything else in the context: the user's request, the retrieved documents, the agent's own plan. Given enough pressure, the model will weigh them differently than you intended. That is not a bug in the model. It is what a prompt is for.",
      },
      { type: "h2", id: "rules-on-the-action", text: "Rules that sit on the action" },
      {
        type: "p",
        text: "Ordin evaluates policies at the moment an agent tries to act. The call, its arguments and the agent's scope go to the policy engine, which returns one of three answers: allow, deny or hold for a person.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Scope: can this agent touch this table, tool or inbox at all?",
          "Spend: does this call fit inside the job's remaining budget?",
          "Sign-off: does this kind of action need a person first?",
        ],
      },
      {
        type: "callout",
        title: "Held, not failed",
        text: "A held action does not fail the run. It waits in a queue with its full trace attached, and the run carries on with everything that does not depend on it.",
      },
      { type: "h2", id: "writing-good-policies", text: "Writing policies people can read" },
      {
        type: "p",
        text: "Policies are short, typed and versioned with your code. Each one names what it protects and why, so an auditor can read the list without reading the agent.",
      },
      {
        type: "code",
        lang: "TypeScript",
        code: `policy("outbound-email", {
  when: (call) => call.tool === "email.send",
  decide: (call) => (call.args.to.length > 5 ? "hold" : "allow"),
  reason: "Bulk email needs a person to approve it",
});`,
      },
    ],
  },
  {
    slug: "the-cost-of-a-finished-run",
    title: "What a finished run really costs",
    summary:
      "Per-token pricing hides the cost of retries, dead ends and abandoned jobs. We switched to pricing per finished run, and here is the maths behind it.",
    category: "Product",
    tags: ["Pricing", "Cost control"],
    date: "2026-10-02",
    author: AUTHORS.maya,
    cover: "bars",
    body: [
      {
        type: "lead",
        text: "A job that takes four attempts costs four times as much under token pricing, even though you only got one result. We think that is backwards.",
      },
      { type: "h2", id: "tokens-hide-waste", text: "Tokens hide the waste" },
      {
        type: "p",
        text: "Token bills measure effort, not outcome. Retries, abandoned plans and long dead ends all count the same as the work that shipped. Teams end up optimising prompts for cost instead of for results.",
      },
      {
        type: "stats",
        items: [
          { value: "2.7x", label: "average attempts per finished job" },
          { value: "38%", label: "lower spend after the switch" },
          { value: "0", label: "charges for failed runs" },
        ],
      },
      { type: "h2", id: "pricing-per-run", text: "Pricing per finished run" },
      {
        type: "p",
        text: "A run is one instruction carried through to a finished result, however many agents and attempts it takes. If it fails, you are not charged. That puts the cost of reliability on us, which is where it belongs.",
      },
      {
        type: "list",
        items: [
          "Starter: free up to 10,000 runs a month",
          "Scale: USD 49 a seat, plus 0.09 cents a run",
          "Enterprise: a volume rate above 500,000 runs",
        ],
      },
      { type: "h2", id: "budgets", text: "Budgets you set before the run" },
      {
        type: "p",
        text: "Every job can carry a budget. The runtime checks it before each step, so a run that is about to overspend stops and asks instead of finishing on your card.",
      },
    ],
  },
  {
    slug: "shared-memory-without-shared-mess",
    title: "Shared memory without the shared mess",
    summary:
      "Six specialists, one job, one memory. How Ordin keeps agents in sync without letting one agent's scratch notes leak into another's work.",
    category: "Engineering",
    tags: ["Memory", "Multi-agent"],
    date: "2026-09-18",
    author: AUTHORS.arjun,
    cover: "nodes",
    body: [
      {
        type: "lead",
        text: "Multi-agent systems fail in a predictable way: agents either forget what the others did, or remember far too much of it.",
      },
      { type: "h2", id: "two-failure-modes", text: "Two ways memory goes wrong" },
      {
        type: "p",
        text: "Give every agent the full history and they drown in it. Context fills with other agents' half-finished thinking, costs climb and answers drift. Give each agent only its own notes and the handoffs break: the analyst re-reads the ledger the researcher already summarised.",
      },
      { type: "h2", id: "scoped-memory", text: "Memory scoped to the job" },
      {
        type: "p",
        text: "Ordin keeps one memory per job, split into what is shared and what is private. Findings, decisions and outputs are shared. Scratch work stays with the agent that wrote it.",
      },
      {
        type: "list",
        items: [
          "Shared: facts, decisions, files and finished outputs",
          "Private: drafts, intermediate reasoning and retries",
          "Expiring: anything tied to a single step is dropped when the step settles",
        ],
      },
      {
        type: "quote",
        text: "Handoffs stopped feeling like a game of telephone. Each agent starts exactly where the last one finished.",
        cite: "Engineering manager, logistics customer",
      },
      { type: "h2", id: "replay", text: "Every write is replayable" },
      {
        type: "p",
        text: "Memory writes are part of the trace. When you replay a run, you see what each agent knew at each step, which makes the question of why it decided something answerable for the first time.",
      },
    ],
  },
  {
    slug: "a-human-in-the-loop-that-scales",
    title: "A human in the loop that actually scales",
    summary:
      "Sign-off queues usually turn into a bottleneck within a week. Three design choices that keep people in control without making them the slowest step.",
    category: "Governance",
    tags: ["Sign-off", "Workflow"],
    date: "2026-09-04",
    author: AUTHORS.lena,
    cover: "wave",
    body: [
      {
        type: "lead",
        text: "Everyone wants a person to approve the risky actions. Nobody wants to be that person when there are three hundred approvals a day.",
      },
      { type: "h2", id: "hold-less", text: "Hold less, but hold the right things" },
      {
        type: "p",
        text: "Most queues fill with low-risk approvals because the rules are too broad. Scope policies narrowly: hold outbound messages to new recipients, not every email; hold payments above a threshold, not every payment.",
      },
      { type: "h2", id: "context-in-the-queue", text: "Put the context in the queue" },
      {
        type: "p",
        text: "An approver should never have to open three tools to decide. Each held action in Ordin arrives with its full trace, the policy that held it and the exact change it wants to make.",
      },
      {
        type: "callout",
        title: "Approve, edit or send back",
        text: "Approvers can change the action before it runs, not only accept or reject it. Most holds end in a small edit, not a rejection.",
      },
      { type: "h2", id: "keep-the-run-moving", text: "Keep the run moving" },
      {
        type: "p",
        text: "A held action pauses only the work that depends on it. Everything else carries on, so a slow approval delays one email, not the whole report.",
      },
      {
        type: "stats",
        items: [
          { value: "4 min", label: "median time to approve" },
          { value: "72%", label: "fewer holds after narrowing scope" },
        ],
      },
    ],
  },
  {
    slug: "field-notes-shipping-our-first-hundred-agents",
    title: "Field notes from our first hundred agents",
    summary:
      "What we learned shipping a hundred agents with customers: the boring problems, the surprising ones, and the checklist we now start every project with.",
    category: "Field notes",
    tags: ["Lessons", "Production"],
    date: "2026-08-21",
    author: AUTHORS.arjun,
    cover: "rings",
    body: [
      {
        type: "lead",
        text: "A hundred agents in, the hard parts were rarely the clever parts. They were naming, scoping and deciding what done means.",
      },
      { type: "h2", id: "define-done", text: "Define done before you define the agent" },
      {
        type: "p",
        text: "The agents that struggled were the ones without a clear finish line. If a person cannot say what a finished job looks like, an agent cannot either.",
      },
      { type: "h2", id: "start-narrow", text: "Start narrow, then widen the scope" },
      {
        type: "p",
        text: "Every successful rollout started with one team, one job and tight permissions. Scope grew only after a month of clean traces.",
      },
      { type: "h2", id: "the-checklist", text: "The checklist we start with" },
      {
        type: "list",
        ordered: true,
        items: [
          "Write down what a finished run produces",
          "List every tool the agent may touch, and nothing else",
          "Set a budget per run before the first test",
          "Decide which actions need a person",
          "Replay the first fifty runs by hand",
        ],
      },
      {
        type: "quote",
        text: "The best agents we shipped were the most boring ones to watch. They did one job, the same way, every time.",
      },
    ],
  },
];

export const CATEGORIES = ["All", ...Array.from(new Set(POSTS.map((p) => p.category)))];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);

// About 200 words a minute, counted across every text block, rounded up
export const readingMinutes = (post: Post) => {
  const words = post.body
    .map((b) => ("text" in b ? b.text : "items" in b && b.type === "list" ? b.items.join(" ") : ""))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
};

// The table of contents: one entry per h2
export const tocFor = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.type === "h2" ? [{ id: b.id, text: b.text }] : []));

// Same category first, then the newest, never the post itself
export const relatedTo = (post: Post, count = 3) =>
  [...POSTS.filter((p) => p.slug !== post.slug)]
    .sort((a, b) => Number(b.category === post.category) - Number(a.category === post.category) || b.date.localeCompare(a.date))
    .slice(0, count);

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
