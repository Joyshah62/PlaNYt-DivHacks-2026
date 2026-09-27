import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server blocks its scripts for any other hostname, so a page opened
  // through an ngrok tunnel renders but never runs. Development only.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],
  // One address for the site: a Google sign-in that starts on www and returns to the bare domain
  // (or the other way round) loses its state cookie and fails with "state mismatch".
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "www.planyt.tech" }], destination: "https://planyt.tech/:path*", permanent: true }];
  },
};

export default nextConfig;
