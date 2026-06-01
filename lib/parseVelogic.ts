// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

export interface FitMetric {
  label: string;
  initial: string;
  final: string;
  change: string;
  description?: string;
}

export interface VelogicData {
  riderName: string;
  date: string;
  sport: string;
  jointAngles: FitMetric[];
  jointMotion: FitMetric[];
  alignment: FitMetric[];
  anthropometry: FitMetric[];
  performance: FitMetric[];
}

// Maps raw label text to a clean display name
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

const JOINT_ANGLE_KEYS = [
  "Knee Angle Min",
  "Knee Angle Max",
  "Ankle Angle Avg",
  "Ankle Angle Range",
  "Hip Angle Min",
  "Hip Angle Max",
  "Shoulder Angle Avg",
  "Elbow Angle Avg",
  "Torso Angle Avg",
  "Arm Angle Avg",
  "Knee Lateral Travel",
  "Knee Travel Angle",
];

const JOINT_MOTION_KEYS = [
  "Hip Vertical Travel",
  "Hip Horizontal Travel",
  "Ankle Swivel",
  "Shoulder Lateral Travel",
];

const ALIGNMENT_KEYS = ["Knee Over Foot", "Hip To Foot", "Hip To Wrist"];

const ANTHROPOMETRY_KEYS = [
  "Thigh Length",
  "Shin Length",
  "Torso Length",
  "Upper Arm Length",
  "Forearm Length",
];

const PERFORMANCE_KEYS = ["Cadence Avg"];

function cleanLabel(raw: string): string {
  // Remove trailing "(R)" or "(L)" side markers
  return raw.replace(/\s*\([RL]\)\s*$/, "").trim();
}

function parseMetricLine(line: string): { label: string; initial: string; final: string; change: string } | null {
  // Pattern: "Label (R/L)   66   68   +2" or similar
  const match = line.match(/^(.+?)\s{2,}([\d.]+)\s+([\d.]+)\s+([+\-=][\d]*)/);
  if (!match) return null;
  return {
    label: cleanLabel(match[1]),
    initial: match[2],
    final: match[3],
    change: match[4],
  };
}

function groupMetrics(allMetrics: FitMetric[], keys: string[]): FitMetric[] {
  return allMetrics.filter((m) =>
    keys.some((k) => m.label.toLowerCase().includes(k.toLowerCase().replace(/\s*\([RL]\)/, "").toLowerCase()))
  );
}

export async function parseVelogicPdf(buffer: Buffer): Promise<VelogicData> {
  const data = await pdfParse(buffer);
  const text = data.text;
  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);

  // Extract header info
  let riderName = "";
  let date = "";
  let sport = "";

  for (const line of lines) {
    if (line.match(/^(Pro Test|Fit for)/i) && !riderName) {
      riderName = line.split(/\s{2,}/)[0].trim();
    }
    if (line.match(/^\d{4}-\d{2}-\d{2}/)) {
      date = line.split(/\s{2,}/)[0].trim();
    }
    if (line.match(/^(Road|MTB|TT|Triathlon|Gravel)/i)) {
      sport = line.split(/\s{2,}/)[0].trim();
    }
  }

  // Try to get rider name from first meaningful line
  if (!riderName && lines.length > 0) {
    riderName = lines[0];
  }

  // Parse all metric rows
  const allMetrics: FitMetric[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseMetricLine(lines[i]);
    if (parsed) {
      // Try to grab description from next line
      const nextLine = lines[i + 1] || "";
      const description = nextLine && !parseMetricLine(nextLine) ? nextLine : undefined;
      allMetrics.push({
        ...parsed,
        label: LABEL_MAP[parsed.label] || parsed.label,
        description,
      });
    }
  }

  // Also try column-based extraction for tables with header "Initial Final Change"
  const tableStartIdx = lines.findIndex((l: string) => l.includes("Initial") && l.includes("Final") && l.includes("Change"));
  if (tableStartIdx >= 0 && allMetrics.length === 0) {
    for (let i = tableStartIdx + 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s{2,}/);
      if (parts.length >= 4) {
        const rawLabel = cleanLabel(parts[0]);
        allMetrics.push({
          label: LABEL_MAP[rawLabel] || rawLabel,
          initial: parts[1],
          final: parts[2],
          change: parts[3],
        });
      }
    }
  }

  return {
    riderName,
    date,
    sport,
    jointAngles: groupMetrics(allMetrics, JOINT_ANGLE_KEYS),
    jointMotion: groupMetrics(allMetrics, JOINT_MOTION_KEYS),
    alignment: groupMetrics(allMetrics, ALIGNMENT_KEYS),
    anthropometry: groupMetrics(allMetrics, ANTHROPOMETRY_KEYS),
    performance: groupMetrics(allMetrics, PERFORMANCE_KEYS),
  };
}
