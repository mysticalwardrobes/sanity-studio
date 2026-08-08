import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "yz23zros",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-01-01",
});

async function main() {
  const count = await client.fetch('count(*[_type == "gown_temp"])');
  console.log(`Total gown_temp documents in Sanity: ${count}`);

  const sample = await client.fetch(`*[_type == "gown_temp"][0]`);
  console.log("Sample gown_temp document:", JSON.stringify(sample, null, 2));
}

main().catch(console.error);
