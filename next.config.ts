import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  trailingSlash: true,

  // This block will be commented out before running bun run build and only used in development to proxy API requests to the modem's web server.


};

export default nextConfig;
