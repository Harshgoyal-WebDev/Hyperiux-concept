// A single shared uniform reference, mutated directly (not through React)
// so LakeSurface can briefly dim the smoke's reflected brightness during
// its mirror render pass and restore it right after — much cheaper than
// duplicating every smoke puff for a second, lower-opacity render pass.
export const smokeReflectionUniform = { value: 1 };

// Same technique, for the cuboid's glass body and its light beams — the
// lake's mirrored render otherwise shows them at exactly the same
// brightness as the real object, which reads as a second, equally strong
// copy sitting in the water instead of a normal, gentler reflection.
export const glowReflectionUniform = { value: 1 };
