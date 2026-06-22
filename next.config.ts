import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions are enabled by default in the App Router; later slices
  // (dashboard, chatbot) build on them. No database or external access here —
  // issue #2 is the boot-only skeleton.
  reactStrictMode: true,
};

export default nextConfig;
