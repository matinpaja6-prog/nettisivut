import { headers } from "next/headers";
import { normalizeRouteLocale } from "./routes";

export async function getServerLocale() {
  return normalizeRouteLocale((await headers()).get("x-maskines-locale"));
}

export async function getServerPathname() {
  return (await headers()).get("x-maskines-pathname") || "/";
}
