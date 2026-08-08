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

function getFieldForSubfolder(subfolderName: string): "longGownPicture" | "pixiePicture" | "filipinianaPicture" | "trainPicture" {
  const sf = subfolderName.toLowerCase().trim();
  if (sf.includes("pixie")) return "pixiePicture";
  if (sf.includes("filipiniana") || sf.includes("sagala")) return "filipinianaPicture";
  if (sf.includes("trail")) return "trainPicture";
  return "longGownPicture";
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

async function main() {
  console.log("=========================================");
  console.log("Step 1: Fetching all gown_temp documents");
  console.log("=========================================");
  const gownTempDocs = await client.fetch(`*[_type == "gown_temp"]{ _id, name }`);
  console.log(`Found ${gownTempDocs.length} gown_temp documents in Sanity.`);

  const docMap = new Map<string, any>();
  for (const doc of gownTempDocs) {
    if (doc.name) {
      docMap.set(normalizeName(doc.name), doc);
    }
  }

  console.log("\n=========================================");
  console.log("Step 2: Clearing existing photo fields on gown_temp");
  console.log("=========================================");
  let clearTx = client.transaction();
  let clearCount = 0;
  for (const doc of gownTempDocs) {
    clearTx.patch(doc._id, (p) =>
      p.unset(["longGownPicture", "longGownPictureAlt", "filipinianaPicture", "pixiePicture", "trainPicture"])
    );
    clearCount++;
  }
  await clearTx.commit();
  console.log(`Cleared existing photo fields on ${clearCount} gown_temp documents.`);

  console.log("\n=========================================");
  console.log("Step 3: Uploading new photos from Gown Photos folder");
  console.log("=========================================");

  const folderEntries = fs.readdirSync(PHOTOS_DIR);
  const gownFolders = folderEntries.filter((e) => {
    const p = path.join(PHOTOS_DIR, e);
    return fs.statSync(p).isDirectory() && !e.startsWith(".") && e !== "x Archives" && e !== "xHood&Others";
  });

  console.log(`Found ${gownFolders.length} gown folders in Gown Photos.`);

  let totalUploadedImages = 0;
  let updatedGownsCount = 0;

  for (const folderName of gownFolders) {
    const key = normalizeName(folderName);
    const targetDoc = docMap.get(key);

    if (!targetDoc) {
      console.log(`⚠️ No matching gown_temp document found for folder: "${folderName}"`);
      continue;
    }

    const gownFolder = path.join(PHOTOS_DIR, folderName);
    const entries = fs.readdirSync(gownFolder);
    const subdirs = entries.filter((e) => fs.statSync(path.join(gownFolder, e)).isDirectory());
    const rootFiles = entries.filter((e) => {
      const p = path.join(gownFolder, e);
      return fs.statSync(p).isFile() && !e.startsWith(".") && /\.(jpg|jpeg|png|webp|heic)$/i.test(e);
    });

    const fieldImageRefs: Record<string, any[]> = {
      longGownPicture: [],
      pixiePicture: [],
      filipinianaPicture: [],
      trainPicture: [],
    };

    // Process Root Files (e.g. Angela, Little Winelle) -> default to longGownPicture
    if (rootFiles.length > 0) {
      const sortedRootFiles = sortFilesWithCoverFirst(rootFiles);
      for (const rf of sortedRootFiles) {
        const fullPath = path.join(gownFolder, rf);
        const isCover = rf.toLowerCase().includes("cover");
        console.log(` Uploading root image for ${targetDoc.name}: ${rf} ${isCover ? "⭐ (COVER)" : ""}`);
        try {
          const assetId = await uploadImage(fullPath);
          fieldImageRefs.longGownPicture.push({
            _type: "image",
            _key: getRandomKey(),
            asset: { _type: "reference", _ref: assetId },
          });
          totalUploadedImages++;
        } catch (err: any) {
          console.error(` Failed to upload ${rf}:`, err.message);
        }
      }
    }

    // Process Version Subfolders
    for (const sd of subdirs) {
      const targetField = getFieldForSubfolder(sd);
      const sdPath = path.join(gownFolder, sd);
      const files = fs.readdirSync(sdPath).filter((f) => !f.startsWith(".") && /\.(jpg|jpeg|png|webp|heic)$/i.test(f));
      const sortedFiles = sortFilesWithCoverFirst(files);

      for (const f of sortedFiles) {
        const fullPath = path.join(sdPath, f);
        const isCover = f.toLowerCase().includes("cover");
        console.log(` Uploading [${sd} -> ${targetField}] for ${targetDoc.name}: ${f} ${isCover ? "⭐ (COVER)" : ""}`);
        try {
          const assetId = await uploadImage(fullPath);
          fieldImageRefs[targetField].push({
            _type: "image",
            _key: getRandomKey(),
            asset: { _type: "reference", _ref: assetId },
          });
          totalUploadedImages++;
        } catch (err: any) {
          console.error(` Failed to upload ${f}:`, err.message);
        }
      }
    }

    // Patch gown_temp document with uploaded image references
    const patchPayload: Record<string, any> = {};
    for (const [fieldName, refs] of Object.entries(fieldImageRefs)) {
      if (refs.length > 0) {
        patchPayload[fieldName] = refs;
      }
    }

    if (Object.keys(patchPayload).length > 0) {
      await client.patch(targetDoc._id).set(patchPayload).commit();
      updatedGownsCount++;
      console.log(`✅ Updated ${targetDoc.name} (${targetDoc._id}) with ${Object.keys(patchPayload).join(", ")}`);
    }
  }

  console.log("\n=========================================");
  console.log("SUMMARY OF MIGRATION");
  console.log("=========================================");
  console.log(`Total Uploaded Images: ${totalUploadedImages}`);
  console.log(`Total Updated Gown Documents: ${updatedGownsCount}`);
}

main().catch((err) => {
  console.error("Upload error:", err);
  process.exit(1);
});
