import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
loadEnvConfig(path.resolve(__dirname, "..", "00.secret"));
const nextConfig: NextConfig = {};
export default nextConfig;
