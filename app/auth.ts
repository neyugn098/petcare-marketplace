import { headers } from "next/headers";
import { resolveActor } from "../db/runtime";
export async function getCurrentActor() { return resolveActor(new Request("http://localhost", { headers: await headers() })); }
