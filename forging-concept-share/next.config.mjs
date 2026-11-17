/** @type {import('next').NextConfig} */
const nextConfig = {
  // this folder is its own project, wherever it is unpacked
  turbopack: { root: import.meta.dirname },
  images: {
    // (the homepage sections ask for 90 / 100)
    qualities: [75, 90, 100],
  },
};

export default nextConfig;
