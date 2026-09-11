/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ixoris/types", "@ixoris/escpos", "@ixoris/sync-client"],
};

module.exports = nextConfig;
