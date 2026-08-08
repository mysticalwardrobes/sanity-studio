import { createClient } from "@sanity/client";

const client = createClient({
  projectId: "yz23zros",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-01-01",
});

async function main() {
  const gowns = await client.fetch(`*[_type == "gown"]{
    _id,
    name,
    longGownPicture,
    longGownPictureAlt,
    filipinianaPicture,
    pixiePicture,
    trainPicture
  }`);
  console.log(`Found ${gowns.length} existing gowns in production dataset.`);
  if (gowns.length > 0) {
    console.log("Sample gown:", JSON.stringify(gowns[0], null, 2));
  }
}

main().catch(console.error);
