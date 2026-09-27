import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server blocks its scripts for any other hostname, so a page opened
  // through an ngrok tunnel renders but never runs. Development only.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
