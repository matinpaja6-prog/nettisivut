import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const nextBuildDirectory = fileURLToPath(new URL("../.next/", import.meta.url));

await rm(nextBuildDirectory, { recursive: true, force: true });
