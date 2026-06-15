import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const buckets = process.argv.slice(2);
const targetBuckets = buckets.length ? buckets : ["avatars", "listing-images"];

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable.");
}

if (!serviceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function listFiles(bucket, prefix = "") {
  const files = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`${bucket}: ${error.message}`);
    }

    if (!data?.length) {
      break;
    }

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.metadata) {
        files.push(path);
      } else {
        files.push(...(await listFiles(bucket, path)));
      }
    }

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return files;
}

async function removeInChunks(bucket, files) {
  const chunkSize = 100;
  let deleted = 0;

  for (let index = 0; index < files.length; index += chunkSize) {
    const chunk = files.slice(index, index + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(chunk);

    if (error) {
      throw new Error(`${bucket}: ${error.message}`);
    }

    deleted += chunk.length;
    console.log(`${bucket}: poistettu ${deleted}/${files.length}`);
  }
}

for (const bucket of targetBuckets) {
  const files = await listFiles(bucket);

  if (!files.length) {
    console.log(`${bucket}: ei poistettavia tiedostoja`);
    continue;
  }

  await removeInChunks(bucket, files);
}

console.log("Storage tyhjennetty.");
