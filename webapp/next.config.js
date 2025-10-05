/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/app',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
