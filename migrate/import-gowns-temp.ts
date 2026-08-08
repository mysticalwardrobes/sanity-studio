import { createClient } from "@sanity/client";
import * as fs from "fs";
import * as path from "path";

const client = createClient({
  projectId: "yz23zros",
  dataset: "production",
  useCdn: false,
  apiVersion: "2023-01-01",
  token: process.env.SANITY_AUTH_TOKEN, // Sanity auth token if available, or CLI context
});

function parseRate(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const cleaned = val.replace(/,/g, "").replace(/₱/g, "").trim();
  if (!cleaned) return undefined;
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

function parseArray(val: string | undefined): string[] | undefined {
  if (!val) return undefined;
  const items = val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function slugify(text: string): string {
  const cleanText = text.replace(/\([^)]*\)/g, "");
  return cleanText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCSVLine(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(currentVal);
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(currentVal);
      if (row.some((cell) => cell.trim().length > 0)) {
        lines.push(row);
      }
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal);
    if (row.some((cell) => cell.trim().length > 0)) {
      lines.push(row);
    }
  }
  return lines;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function run() {
  console.log("Reading Gowns.csv...");
  const csvPath = path.resolve(__dirname, "../../Gowns.csv");
  const rawContent = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSVLine(rawContent);

  const headers = rows[0];
  console.log(`Found ${rows.length - 1} gown rows in CSV.`);

  // Query existing live gown documents to preserve picture fields
  console.log("Fetching existing live 'gown' documents from Sanity...");
  const existingGowns = await client.fetch(`*[_type == "gown"]{
    _id,
    name,
    longGownPicture,
    longGownPictureAlt,
    filipinianaPicture,
    pixiePicture,
    trainPicture,
    isUndergoingRedesign,
    redesignNotes
  }`);

  const existingMap = new Map<string, any>();
  for (const eg of existingGowns) {
    if (eg.name) {
      existingMap.set(normalizeName(eg.name), eg);
    }
  }
  console.log(`Mapped ${existingMap.size} existing gowns for picture copying.`);

  const gownTempDocs: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[0].trim()) continue;

    const name = r[0].trim();
    const docId = `gown-temp-${slugify(name)}`;

    const upcomingDesign = r[1]?.trim() || undefined;
    const gownStatus = r[2]?.trim() || undefined;
    const metroManilaRate = parseRate(r[3]);
    const luzonRate = parseRate(r[4]);
    const outsideLuzonRate = parseRate(r[5]);
    const metroManilaRateDiscount = parseRate(r[6]);
    const luzonRateDiscount = parseRate(r[7]);
    const outsideLuzonRateDiscount = parseRate(r[8]);
    const pixieMetroManilaRate = parseRate(r[9]);
    const pixieLuzonRate = parseRate(r[10]);
    const pixieOutsideLuzonRate = parseRate(r[11]);
    const pixieMetroManilaRateDiscount = parseRate(r[12]);
    const pixieLuzonRateDiscount = parseRate(r[13]);
    const pixieOutsideLuzonRateDiscount = parseRate(r[14]);
    const forSaleRateLong = parseRate(r[15]);
    const forSaleRatePixie = parseRate(r[16]);
    const gownFeatures = r[17]?.trim() || undefined;
    const wardrobeFeatures = parseArray(r[18]);
    const bestFor = parseArray(r[19]);
    const tags = parseArray(r[20]);
    const color = parseArray(r[21]);
    const corsetCount = r[22]?.trim() || undefined;
    const ageGroup = parseArray(r[23]);
    const petticoats = parseArray(r[24]);
    const bustMin = parseRate(r[25]);
    const bustMax = r[26]?.trim() || undefined;
    const waistMin = parseRate(r[27]);
    const waistMax = r[28]?.trim() || undefined;
    const length = r[29]?.trim() || undefined;
    const petticoatFitCode = r[30]?.trim() || undefined;
    const waistMaxPixie = r[31]?.trim() || undefined;
    const lengthPixie = r[32]?.trim() || undefined;

    // Check match with existing gown to copy picture arrays
    const matchedExisting = existingMap.get(normalizeName(name));

    const doc: any = {
      _id: docId,
      _type: "gown_temp",
      name,
      slug: {
        _type: "slug",
        current: slugify(name),
      },
      ...(upcomingDesign && { upcomingDesign }),
      ...(gownStatus && { gownStatus }),
      ...(metroManilaRate !== undefined && { metroManilaRate }),
      ...(luzonRate !== undefined && { luzonRate }),
      ...(outsideLuzonRate !== undefined && { outsideLuzonRate }),
      ...(metroManilaRateDiscount !== undefined && { metroManilaRateDiscount }),
      ...(luzonRateDiscount !== undefined && { luzonRateDiscount }),
      ...(outsideLuzonRateDiscount !== undefined && { outsideLuzonRateDiscount }),
      ...(pixieMetroManilaRate !== undefined && { pixieMetroManilaRate }),
      ...(pixieLuzonRate !== undefined && { pixieLuzonRate }),
      ...(pixieOutsideLuzonRate !== undefined && { pixieOutsideLuzonRate }),
      ...(pixieMetroManilaRateDiscount !== undefined && { pixieMetroManilaRateDiscount }),
      ...(pixieLuzonRateDiscount !== undefined && { pixieLuzonRateDiscount }),
      ...(pixieOutsideLuzonRateDiscount !== undefined && { pixieOutsideLuzonRateDiscount }),
      ...(forSaleRateLong !== undefined && { forSaleRateLong }),
      ...(forSaleRatePixie !== undefined && { forSaleRatePixie }),
      ...(gownFeatures && { gownFeatures }),
      ...(wardrobeFeatures && { wardrobeFeatures }),
      ...(bestFor && { bestFor }),
      ...(tags && { tags }),
      ...(color && { color }),
      ...(corsetCount && { corsetCount }),
      ...(ageGroup && { ageGroup }),
      ...(petticoats && { petticoats }),
      ...(bustMin !== undefined && { bustMin }),
      ...(bustMax && { bustMax }),
      ...(waistMin !== undefined && { waistMin }),
      ...(waistMax && { waistMax }),
      ...(length && { length }),
      ...(petticoatFitCode && { petticoatFitCode }),
      ...(waistMaxPixie && { waistMaxPixie }),
      ...(lengthPixie && { lengthPixie }),
    };

    if (matchedExisting) {
      if (matchedExisting.longGownPicture) doc.longGownPicture = matchedExisting.longGownPicture;
      if (matchedExisting.longGownPictureAlt) doc.longGownPictureAlt = matchedExisting.longGownPictureAlt;
      if (matchedExisting.filipinianaPicture) doc.filipinianaPicture = matchedExisting.filipinianaPicture;
      if (matchedExisting.pixiePicture) doc.pixiePicture = matchedExisting.pixiePicture;
      if (matchedExisting.trainPicture) doc.trainPicture = matchedExisting.trainPicture;
      if (matchedExisting.isUndergoingRedesign !== undefined) doc.isUndergoingRedesign = matchedExisting.isUndergoingRedesign;
      if (matchedExisting.redesignNotes) doc.redesignNotes = matchedExisting.redesignNotes;
    }

    gownTempDocs.push(doc);
  }

  console.log(`Parsed ${gownTempDocs.length} gown_temp documents. Upserting into Sanity...`);

  const transaction = client.transaction();
  for (const doc of gownTempDocs) {
    transaction.createOrReplace(doc);
  }
  await transaction.commit();

  console.log(`Successfully upserted ${gownTempDocs.length} gown_temp documents into Sanity production dataset!`);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
