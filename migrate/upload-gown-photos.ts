import { createClient } from "@sanity/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const client = createClient({
  projectId: "yz23zros",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-01-01",
  token: process.env.SANITY_AUTH_TOKEN, // Requires token with write access
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

function getRandomKey(): string {
  return crypto.randomBytes(6).toString("hex");
}

function getFieldForSubfolder(subfolderName: string): "longGownPicture" | "pixiePicture" | "filipinianaPicture" | "trainPicture" {
  const sf = subfolderName.toLowerCase().trim();
  if (sf.includes("pixie")) return "pixiePicture";
  if (sf.includes("filipiniana") || sf.includes("sagala")) return "filipinianaPicture";
  if (sf.includes("trail")) return "trainPicture";
  // Default for Long, Long Version, Corset 1, Corset 2, Neck Collar, etc.
  return "longGownPicture";
}

async function uploadImage(filePath: string): Promise<string> {
  const fileName = path.basename(filePath);
  const stream = fs.createReadStream(filePath);
  const asset = await client.assets.upload("image", stream, { filename: fileName });
  return asset._id;
}

export async function uploadPhotosForGown(gownName: string, folderName: string, dryRun = true) {
  const gownFolder = path.join(PHOTOS_DIR, folderName);
  const docId = `gown-temp-${slugify(gownName)}`;

  if (!fs.existsSync(gownFolder)) {
    console.log(`Folder not found: ${gownFolder}`);
    return;
  }

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

  // 1. Process Root Files -> default longGownPicture
  for (const rf of rootFiles) {
    const fullPath = path.join(gownFolder, rf);
    console.log(`  [${gownName}] Uploading root image: ${rf}`);
    if (!dryRun) {
      const assetId = await uploadImage(fullPath);
      fieldImageRefs.longGownPicture.push({
        _type: "image",
        _key: getRandomKey(),
        asset: { _type: "reference", _ref: assetId },
      });
    }
  }

  // 2. Process Subfolders
  for (const sd of subdirs) {
    const fieldName = getFieldForSubfolder(sd);
    const sdPath = path.join(gownFolder, sd);
    const files = fs.readdirSync(sdPath).filter((f) => !f.startsWith(".") && /\.(jpg|jpeg|png|webp|heic)$/i.test(f));

    for (const f of files) {
      const fullPath = path.join(sdPath, f);
      console.log(`  [${gownName}] Uploading ${sd} -> ${fieldName}: ${f}`);
      if (!dryRun) {
        const assetId = await uploadImage(fullPath);
        fieldImageRefs[fieldName].push({
          _type: "image",
          _key: getRandomKey(),
          asset: { _type: "reference", _ref: assetId },
        });
      }
    }
  }

  if (!dryRun) {
    const patchPayload: Record<string, any> = {};
    for (const [key, refs] of Object.entries(fieldImageRefs)) {
      if (refs.length > 0) {
        patchPayload[key] = refs;
      }
    }
    if (Object.keys(patchPayload).length > 0) {
      await client.patch(docId).set(patchPayload).commit();
      console.log(`Updated document ${docId} with uploaded image references.`);
    }
  }
}
