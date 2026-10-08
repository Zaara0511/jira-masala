/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
          ? new URL(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT).hostname
          : "cloud.appwrite.io",
      }
    ]
  }
};

export default nextConfig;
