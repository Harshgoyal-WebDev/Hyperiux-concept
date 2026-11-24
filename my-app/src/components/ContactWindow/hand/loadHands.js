// The model both hands are made from (public/human_hand.glb: hand/handModel.js).
const HAND_URL = "/human_hand.glb";

// The hands' geometry for a particle count, built from the model in a worker
// (and kept for the page's life: built once, however often the scene mounts).
// Falls back to building it here if workers aren't available.
const cache = new Map();
let nextId = 1;

async function buildHere(url, particles) {
  const { buildHand } = await import("./handModel");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`hand model: ${res.status} ${url}`);
  return buildHand(await res.arrayBuffer(), { particles });
}

export function loadHands(particles) {
  if (cache.has(particles)) return cache.get(particles);
  const url = new URL(HAND_URL, window.location.href).href;
  const job = new Promise((resolve, reject) => {
    const inline = () => buildHere(url, particles).then(resolve, reject);
    let worker;
    try {
      worker = new Worker(new URL("./hand.worker.js", import.meta.url), { type: "module" });
    } catch {
      inline();
      return;
    }
    const id = nextId++;
    worker.onmessage = (e) => {
      if (e.data.id !== id) return;
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      inline();
    };
    worker.postMessage({ url, particles, id });
  });
  // (a failed load isn't kept: the next mount tries again)
  job.catch(() => cache.delete(particles));
  cache.set(particles, job);
  return job;
}
