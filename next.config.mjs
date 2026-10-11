/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // The scoreboard moved to /ongoing-match/<id> with the new design. A phone that still has the old page open
      // goes home, where Start Game opens the running match.
      {source: "/match/:path*", destination: "/", permanent: false},
    ];
  },
};

export default nextConfig;
