import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones / other devices on the LAN to load dev assets.
  // Next blocks cross-origin dev requests by default, which 403s the
  // JS chunks when you open the app via the machine's IP, leaving the
  // page styled but un-hydrated (buttons/camera dead). List the hosts
  // you reach the dev server from. `*` matches one address segment.
  allowedDevOrigins: [
    "145.94.174.132",
    "145.94.*.*",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ],
};

export default nextConfig;
