import path from "path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
}

export default nextConfig
