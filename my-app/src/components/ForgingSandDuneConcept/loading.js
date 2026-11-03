import { ASSETS } from "./config";

// What the loader waits for, and how far along it is:
//   the forge's GLB downloading (fetched here with its byte progress; the
//     scene's own loader then finds it in the browser's cache),
//   the forge built in the scene (J.forgeReady).
// A file that fails to download counts as done (the scene reports it).
const bytes = { forge: 0 };
let started = false;

async function prefetch(url, key) {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(res.status);
    // (compressed responses give no usable length: the bar then waits for
    // the whole file)
    const total = res.headers.get("content-encoding") ? 0 : Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (total) bytes[key] = Math.min(got / total, 0.999);
    }
  } catch {
    // the scene's own loader reports a missing file
  }
  bytes[key] = 1;
}

export function startLoading() {
  if (started) return;
  started = true;
  prefetch(ASSETS.forgeGlb, "forge");
}

// 0..1 (1 only once everything is in)
export function loadProgress(J, assetProblem) {
  const forgeReady = J.forgeReady || !!assetProblem;
  return bytes.forge * 0.75 + (forgeReady ? 0.25 : 0);
}
