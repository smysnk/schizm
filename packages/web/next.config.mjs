import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

const resolveServerOrigin = () => {
  const serverPort = process.env.SERVER_PORT || "4000";
  const raw = process.env.SERVER_URL || `http://127.0.0.1:${serverPort}`;
  return raw.replace(/\/$/, "");
};

const serverOrigin = resolveServerOrigin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/graphql",
        destination: `${serverOrigin}/graphql`
      },
      {
        source: "/health",
        destination: `${serverOrigin}/health`
      }
    ];
  }
};

export default nextConfig;
