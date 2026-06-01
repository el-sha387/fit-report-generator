import type { VelogicData, FitMetric } from "./parseVelogic";

const LABEL_MAP: Record<string, string> = {
  "Knee Angle Min": "Kniewinkel Min",
  "Knee Angle Max": "Kniewinkel Max",
  "Ankle Angle Avg": "Sprunggelenk Ø",
  "Ankle Angle Range": "Sprunggelenk Range",
  "Hip Angle Min": "Hüftwinkel Min",
  "Hip Angle Max": "Hüftwinkel Max",
  "Shoulder Angle Avg": "Schulterwinkel Ø",
  "Elbow Angle Avg": "Ellenbogenwinkel Ø",
  "Torso Angle Avg": "Rumpfwinkel Ø",
  "Arm Angle Avg": "Armwinkel Ø",
  "Knee Lateral Travel": "Knie Lateralbewegung",
  "Knee Travel Angle": "Knie Bewegungswinkel",
  "Hip Vertical Travel": "Hüfte Vertikalbewegung",
  "Hip Horizontal Travel": "Hüfte Horizontalbewegung",
  "Ankle Swivel": "Sprunggelenk Rotation",
  "Shoulder Lateral Travel": "Schulter Lateralbewegung",
  "Knee Over Foot": "Knie über Fuß",
  "Hip To Foot": "Hüfte zu Fuß",
  "Hip To Wrist": "Hüfte zu Handgelenk",
  "Thigh Length": "Oberschenkellänge",
  "Shin Length": "Unterschenkellänge",
  "Torso Length": "Rumpflänge",
  "Upper Arm Length": "Oberarmlänge",
  "Forearm Length": "Unterarmlänge",
  "Cadence Avg": "Trittfrequenz Ø",
};

const JOINT_ANGLE_KEYS = ["Knee Angle Min","Knee Angle Max","Ankle Angle Avg","Ankle Angle Range","Hip Angle Min","Hip Angle Max","Shoulder Angle Avg","Elbow Angle Avg","Torso Angle Avg","Arm Angle Avg","Knee Lateral Travel","Knee Travel Angle"];
const JOINT_MOTION_KEYS = ["Hip Vertical Travel","Hip Horizontal Travel","Ankle Swivel","Shoulder Lateral Travel"];
const ALIGNMENT_KEYS = ["Knee Over Foot","Hip To Foot","Hip To Wrist"];
const ANTHROPOMETRY_KEYS = ["Thigh Length","Shin Length","Torso Length","Upper Arm Length","Forearm Length"];
const PERFORMANCE_KEYS = ["Cadence Avg"];

function cleanLabel(raw: string): string {
  return raw.replace(/\s*\([RL]\)\s*$/, "").trim();
}

function groupMetrics(all: FitMetric[], keys: string[]): FitMetric[] {
  return all.filter((m) =>
    keys.some((k) => {
      const normalK = k.toLowerCase();
      const normalM = m.label.toLowerCase();
      return normalM.includes(normalK);
    })
  );
}

export async function parseVelogicClient(file: File): Promise<VelogicData> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let riderName = "";
  let date = "";
  let sport = "";

  // Find rider name (usually first non-empty line before "Road"/"MTB" etc)
  for (const line of lines) {
    if (!riderName && line.length > 2 && !line.match(/^(Velogic|Fit Report|COMPARISON|BIOMECHANICAL)/i)) {
      riderName = line;
    }
    if (line.match(/^\d{4}-\d{2}-\d{2}/)) date = line.split(/\s+/)[0];
    if (line.match(/^(Road|MTB|TT|Triathlon|Gravel)$/i)) sport = line;
  }

  // Find the metrics table — look for "Initial Final Change" header
  const tableIdx = lines.findIndex(
    (l) => l.includes("Initial") && l.includes("Final") && l.includes("Change")
  );

  const allMetrics: FitMetric[] = [];

  if (tableIdx >= 0) {
    // After the header, rows come in groups: label, description, init, final, change
    // pdfjs extracts text items, so the structure can vary — collect tokens after header
    const tokens = lines.slice(tableIdx + 1);
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      // A label line: text that matches a known metric (with optional (R)/(L))
      const rawLabel = cleanLabel(t);
      const mappedLabel = LABEL_MAP[rawLabel];
      if (mappedLabel) {
        // Next tokens: optional description, then initial, final, change
        let j = i + 1;
        let description = "";
        // Skip description lines (not numbers)
        while (j < tokens.length && !tokens[j].match(/^\d+(\.\d+)?$/)) {
          description = tokens[j];
          j++;
        }
        const initial = tokens[j] || "";
        const final_ = tokens[j + 1] || "";
        const change = tokens[j + 2] || "";
        if (initial.match(/^\d/) && final_.match(/^\d/)) {
          allMetrics.push({ label: mappedLabel, initial, final: final_, change, description });
          i = j + 3;
          continue;
        }
      }
      i++;
    }
  }

  // Fallback: parse space-separated lines "Label   66   68   +2"
  if (allMetrics.length === 0) {
    for (const line of lines) {
      const match = line.match(/^(.+?)\s{2,}([\d.]+)\s+([\d.]+)\s+([+\-=][\d]*)/);
      if (match) {
        const rawLabel = cleanLabel(match[1]);
        allMetrics.push({
          label: LABEL_MAP[rawLabel] || rawLabel,
          initial: match[2],
          final: match[3],
          change: match[4],
        });
      }
    }
  }

  return {
    riderName: riderName || "Rider",
    date: date || new Date().toISOString().split("T")[0],
    sport: sport || "Road",
    jointAngles: groupMetrics(allMetrics, JOINT_ANGLE_KEYS),
    jointMotion: groupMetrics(allMetrics, JOINT_MOTION_KEYS),
    alignment: groupMetrics(allMetrics, ALIGNMENT_KEYS),
    anthropometry: groupMetrics(allMetrics, ANTHROPOMETRY_KEYS),
    performance: groupMetrics(allMetrics, PERFORMANCE_KEYS),
  };
}
