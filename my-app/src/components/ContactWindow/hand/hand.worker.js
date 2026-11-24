// Builds both hands' geometry off the main thread (hand/handModel.js), so
// loading and sampling the model never stalls the page:
// { url, particles } → the anatomy and the arrays.
import { buildHand, transferables } from "./handModel";

self.onmessage = async (e) => {
  const { url, particles, id } = e.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`hand model: ${res.status} ${url}`);
    const hand = await buildHand(await res.arrayBuffer(), { particles });
    self.postMessage({ id, ...hand }, transferables(hand));
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
