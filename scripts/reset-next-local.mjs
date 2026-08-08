import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectories = [".next", ".next-dev"];

for (const directoryName of outputDirectories) {
  const target = path.resolve(projectRoot, directoryName);
  const relativeTarget = path.relative(projectRoot, target);

  if (relativeTarget !== directoryName || path.dirname(target) !== path.resolve(projectRoot)) {
    throw new Error(`Refusing to remove an unexpected path: ${target}`);
  }

  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 150
  });

  console.log(`Removed ${target}`);
}
