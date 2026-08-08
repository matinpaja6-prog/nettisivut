import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextDirectory = fileURLToPath(new URL("../.next/", import.meta.url));

let entries = [];

try {
  entries = await readdir(nextDirectory, { withFileTypes: true });
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

await Promise.all(
  entries
    .filter((entry) => entry.name !== "cache")
    .map((entry) =>
      rm(path.join(nextDirectory, entry.name), {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100
      })
    )
);

// Compiler caches are safe to preserve, but the server fetch cache can contain
// stale Supabase responses from an older deployment (including cached 404s).
await rm(path.join(nextDirectory, "cache", "fetch-cache"), {
  recursive: true,
  force: true,
  maxRetries: 3,
  retryDelay: 100
});
