import { createClient } from "@sanity/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const client = createClient({
  projectId: "yz23zros",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-01-01",
  token: process.env.SANITY_AUTH_TOKEN, // Requires write permissions token
});

const PHOTOS_DIR = path.resolve(__dirname, "../Gown Photos");

function slugify(text: string): string {
  const cleanText = text.replace(/\([^)]*\)/g, "").split("-")[0].trim();
  return cleanText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(name: string): string {
  const cleanText = name.replace(/\([^)]*\)/g, "").split("-")[0].trim();
  return cleanText.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getRandomKey(): string {
  return crypto.randomBytes(6).toString("hex");
}

function sortFilesWithCoverFirst(files: string[]): string[] {
  return files.sort((a, b) => {
    const aIsCover = a.toLowerCase().includes("cover");
    const bIsCover = b.toLowerCase().includes("cover");
    if (aIsCover && !bIsCover) return -1;
    if (!aIsCover && bIsCover) return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

async function uploadImage(filePath: string): Promise<string> {
  const fileName = path.basename(filePath);
  const stream = fs.createReadStream(filePath);
  const asset = await client.assets.upload("image", stream, { filename: fileName });
  return asset._id;
}

function detectCorsetSubfolders(gownFolder: string): { design1Dir: string; design2Dir: string } | null {
  const fpath = path.join(PHOTOS_DIR, gownFolder);
  if (!fs.existsSync(fpath) || !fs.statSync(fpath).isDirectory()) return null;

  const subdirs = fs.readdirSync(fpath).filter((s) => fs.statSync(path.join(fpath, s)).isDirectory());

  let c1: string | null = null;
  let c2: string | null = null;

  for (const s of subdirs) {
    const sl = s.toLowerCase();
    if (sl.includes("corset 1") || sl.includes("version 1") || sl.includes("design 1")) {
      c1 = s;
    } else if (sl.includes("corset 2") || sl.includes("version 2") || sl.includes("design 2")) {
      c2 = s;
    }
  }

  // Fallback: Check if there are 2 subfolders matching 'long'
  if (!c1 || !c2) {
    const longSubdirs = subdirs.filter((s) => s.toLowerCase().includes("long"));
    if (longSubdirs.length >= 2) {
      const sorted = longSubdirs.sort();
      c1 = sorted[0];
      c2 = sorted[1];
    }
  }

  if (c1 && c2) {
    return { design1Dir: c1, design2Dir: c2 };
  }

  return null;
}

async function main() {
  console.log("=================================================");
  console.log("Detecting gowns with multiple long gown designs...");
  console.log("=================================================");

  const folderEntries = fs.readdirSync(PHOTOS_DIR);
  const targetGowns: { gownFolder: string; design1Dir: string; design2Dir: string }[] = [];

  for (const folder of folderEntries) {
    if (folder.startsWith(".") || folder === "x Archives" || folder === "xHood&Others") continue;
    const corsets = detectCorsetSubfolders(folder);
    if (corsets) {
      targetGowns.push({
        gownFolder: folder,
        design1Dir: corsets.design1Dir,
        design2Dir: corsets.design2Dir,
      });
    }
  }

  console.log(`Found ${targetGowns.length} gowns with multiple long gown designs:`);
  for (const tg of targetGowns) {
    console.log(` - Gown: "${tg.gownFolder}" | Design 1: "${tg.design1Dir}" | Design 2: "${tg.design2Dir}"`);
  }

  if (targetGowns.length === 0) {
    console.log("No gowns found with multiple long gown versions.");
    return;
  }

  // Fetch target gown_temp documents from Sanity
  const gownTempDocs = await client.fetch(`*[_type == "gown_temp"]{ _id, name }`);
  const docMap = new Map<string, any>();
  for (const doc of gownTempDocs) {
    if (doc.name) {
      docMap.set(normalizeName(doc.name), doc);
    }
  }

  for (const tg of targetGowns) {
    const key = normalizeName(tg.gownFolder);
    const targetDoc = docMap.get(key);

    if (!targetDoc) {
      console.log(`⚠️ Warning: Sanity gown_temp document not found for folder "${tg.gownFolder}"`);
      continue;
    }

    console.log(`\n-------------------------------------------------`);
    console.log(`Processing Gown: ${targetDoc.name} (${targetDoc._id})`);
    console.log(`-------------------------------------------------`);

    // Step A: Unset/delete existing longGownPicture and longGownPictureAlt fields on Sanity
    console.log(` Clearing existing longGownPicture & longGownPictureAlt on ${targetDoc._id}...`);
    await client.patch(targetDoc._id).unset(["longGownPicture", "longGownPictureAlt"]).commit();

    // Step B: Upload Design 1 -> longGownPicture
    const d1Path = path.join(PHOTOS_DIR, tg.gownFolder, tg.design1Dir);
    const d1Files = fs
      .readdirSync(d1Path)
      .filter((f) => !f.startsWith(".") && /\.(jpg|jpeg|png|webp|heic)$/i.test(f));
    const sortedD1Files = sortFilesWithCoverFirst(d1Files);

    const longGownRefs: any[] = [];
    for (const f of sortedD1Files) {
      const fullPath = path.join(d1Path, f);
      const isCover = f.toLowerCase().includes("cover");
      console.log(`  Uploading Design 1 (longGownPicture): ${f} ${isCover ? "⭐ (COVER)" : ""}`);
      try {
        const assetId = await uploadImage(fullPath);
        longGownRefs.push({
          _type: "image",
          _key: getRandomKey(),
          asset: { _type: "reference", _ref: assetId },
        });
      } catch (err: any) {
        console.error(`  Failed to upload ${f}:`, err.message);
      }
    }

    // Step C: Upload Design 2 -> longGownPictureAlt
    const d2Path = path.join(PHOTOS_DIR, tg.gownFolder, tg.design2Dir);
    const d2Files = fs
      .readdirSync(d2Path)
      .filter((f) => !f.startsWith(".") && /\.(jpg|jpeg|png|webp|heic)$/i.test(f));
    const sortedD2Files = sortFilesWithCoverFirst(d2Files);

    const longGownAltRefs: any[] = [];
    for (const f of sortedD2Files) {
      const fullPath = path.join(d2Path, f);
      const isCover = f.toLowerCase().includes("cover");
      console.log(`  Uploading Design 2 (longGownPictureAlt): ${f} ${isCover ? "⭐ (COVER)" : ""}`);
      try {
        const assetId = await uploadImage(fullPath);
        longGownAltRefs.push({
          _type: "image",
          _key: getRandomKey(),
          asset: { _type: "reference", _ref: assetId },
        });
      } catch (err: any) {
        console.error(`  Failed to upload ${f}:`, err.message);
      }
    }

    // Step D: Commit Document Patch
    const patchPayload: Record<string, any> = {};
    if (longGownRefs.length > 0) patchPayload.longGownPicture = longGownRefs;
    if (longGownAltRefs.length > 0) patchPayload.longGownPictureAlt = longGownAltRefs;

    if (Object.keys(patchPayload).length > 0) {
      await client.patch(targetDoc._id).set(patchPayload).commit();
      console.log(`✅ Successfully reuploaded ${targetDoc.name}:`);
      console.log(`   longGownPicture (Design 1): ${longGownRefs.length} photos`);
      console.log(`   longGownPictureAlt (Design 2): ${longGownAltRefs.length} photos`);
    }
  }

  console.log("\n=================================================");
  console.log("REUPLOAD OF MULTIPLE LONG GOWN VERSIONS COMPLETED!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Error in reupload script:", err);
  process.exit(1);
});
