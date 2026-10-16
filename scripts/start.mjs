import "dotenv/config";
import { cp, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
await cp(resolve(root, ".next/static"), resolve(root, ".next/standalone/.next/static"), { recursive: true });
try { await access(resolve(root, "public")); await cp(resolve(root, "public"), resolve(root, ".next/standalone/public"), { recursive: true }); }
catch (error) { if (error.code !== "ENOENT") throw error; }
process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";
await import(pathToFileURL(resolve(root, ".next/standalone/server.js")).href);
