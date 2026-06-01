import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import type { VelogicData, FitMetric } from "./parseVelogic";

// gebioMized brand colors
const BRAND_BLUE = rgb(0.0, 0.349, 0.612);   // #005A9C
const BRAND_DARK = rgb(0.133, 0.133, 0.133); // #222222
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
const MID_GRAY = rgb(0.6, 0.6, 0.6);
const GREEN = rgb(0.133, 0.545, 0.133);
const RED = rgb(0.8, 0.1, 0.1);

const PAGE_W = 595;  // A4
const PAGE_H = 842;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawHeader(page: PDFPage, bold: PDFFont, regular: PDFFont, riderName: string, date: string, sport: string, pageNum: number) {
  // Blue top bar
  page.drawRectangle({ x: 0, y: PAGE_H - 50, width: PAGE_W, height: 50, color: BRAND_BLUE });

  // Logo text
  page.drawText("gebioMized", { x: MARGIN, y: PAGE_H - 33, size: 16, font: bold, color: WHITE });
  page.drawText("FIT REPORT", { x: MARGIN + 108, y: PAGE_H - 33, size: 16, font: regular, color: WHITE });

  // Right: rider info
  const infoText = `${riderName}  |  ${sport}  |  ${date}`;
  page.drawText(infoText, {
    x: PAGE_W - MARGIN - 200,
    y: PAGE_H - 33,
    size: 8,
    font: regular,
    color: WHITE,
  });

  // Page number
  page.drawText(`${pageNum}`, {
    x: PAGE_W - MARGIN,
    y: PAGE_H - 33,
    size: 8,
    font: regular,
    color: WHITE,
  });
}

function drawFooter(page: PDFPage, regular: PDFFont) {
  page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_W - MARGIN, y: 30 }, thickness: 0.5, color: MID_GRAY });
  page.drawText("SnM gebioMized GmbH  |  Wilhelm-Schickard-Str. 12, 48149 Münster  |  conceptlab@gebiomized.de", {
    x: MARGIN, y: 16, size: 7, font: regular, color: MID_GRAY,
  });
}

function drawSectionTitle(page: PDFPage, bold: PDFFont, title: string, y: number): number {
  page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 22, color: BRAND_BLUE });
  page.drawText(title.toUpperCase(), { x: MARGIN + 8, y: y + 4, size: 9, font: bold, color: WHITE });
  return y - 28;
}

function drawMetricsTable(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  metrics: FitMetric[],
  startY: number,
  unit = "°"
): number {
  const COL_LABEL = MARGIN;
  const COL_INIT = MARGIN + CONTENT_W * 0.55;
  const COL_FINAL = MARGIN + CONTENT_W * 0.7;
  const COL_CHANGE = MARGIN + CONTENT_W * 0.85;
  const ROW_H = 16;

  // Table header
  page.drawRectangle({ x: MARGIN, y: startY - 2, width: CONTENT_W, height: 14, color: LIGHT_GRAY });
  page.drawText("Messwert", { x: COL_LABEL + 4, y: startY + 2, size: 7, font: bold, color: BRAND_DARK });
  page.drawText("Initial", { x: COL_INIT, y: startY + 2, size: 7, font: bold, color: BRAND_DARK });
  page.drawText("Final", { x: COL_FINAL, y: startY + 2, size: 7, font: bold, color: BRAND_DARK });
  page.drawText("Änderung", { x: COL_CHANGE, y: startY + 2, size: 7, font: bold, color: BRAND_DARK });

  let y = startY - ROW_H;

  metrics.forEach((m, idx) => {
    const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
    page.drawRectangle({ x: MARGIN, y: y - 2, width: CONTENT_W, height: ROW_H, color: bg });

    page.drawText(m.label, { x: COL_LABEL + 4, y: y + 3, size: 8, font: regular, color: BRAND_DARK });

    const initVal = m.initial ? `${m.initial}${unit}` : "—";
    const finalVal = m.final ? `${m.final}${unit}` : "—";
    page.drawText(initVal, { x: COL_INIT, y: y + 3, size: 8, font: regular, color: BRAND_DARK });
    page.drawText(finalVal, { x: COL_FINAL, y: y + 3, size: 8, font: regular, color: BRAND_DARK });

    // Color-coded change
    const change = m.change || "=";
    const changeColor = change.startsWith("+") ? GREEN : change.startsWith("-") ? RED : MID_GRAY;
    page.drawText(change, { x: COL_CHANGE, y: y + 3, size: 8, font: bold, color: changeColor });

    y -= ROW_H;
  });

  return y - 8;
}

export async function generateUnifiedReport(
  velogicData: VelogicData,
  v7PdfBytes: Uint8Array
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const { riderName, date, sport } = velogicData;

  // ── PAGE 1: Cover ────────────────────────────────────────────────────────────
  const cover = doc.addPage([PAGE_W, PAGE_H]);

  // Blue diagonal header block
  cover.drawRectangle({ x: 0, y: PAGE_H - 160, width: PAGE_W, height: 160, color: BRAND_BLUE });

  cover.drawText("gebioMized", { x: MARGIN, y: PAGE_H - 70, size: 36, font: bold, color: WHITE });
  cover.drawText("FIT REPORT", { x: MARGIN, y: PAGE_H - 105, size: 28, font: regular, color: WHITE });

  cover.drawText(riderName || "Rider", { x: MARGIN, y: PAGE_H - 200, size: 22, font: bold, color: BRAND_DARK });
  cover.drawText(`${sport || "Bike Fit"}  |  ${date || ""}`, { x: MARGIN, y: PAGE_H - 225, size: 12, font: regular, color: MID_GRAY });

  cover.drawLine({ start: { x: MARGIN, y: PAGE_H - 240 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 240 }, thickness: 1, color: BRAND_BLUE });

  const introText = [
    "Vielen Dank für Dein gebioMized Bike Fitting.",
    "Dieser Report dokumentiert die Ergebnisse Deiner individuellen Analyse",
    "und enthält biomechanische Messwerte sowie visuelle Befunde.",
    "",
    "Bei Fragen stehen wir Dir jederzeit zur Verfügung.",
  ];
  let introY = PAGE_H - 270;
  for (const line of introText) {
    cover.drawText(line, { x: MARGIN, y: introY, size: 10, font: regular, color: BRAND_DARK });
    introY -= 16;
  }

  // Scope bullet list
  const scope = [
    "Flexibilitäts- und Stabilitätstest",
    "Videoanalyse in verschiedenen Perspektiven",
    "Satteldruckmessung",
    "Sattelauswahl",
    "Optimierung: Sitzhöhe, Sitzlänge, Sattelposition",
    "Lenkeranpassung",
    "Vorher-Nachher-Vergleich",
    "Biomechanische Winkelanalyse",
    "Reporterstellung",
  ];

  cover.drawText("UMFANG DER ANALYSE", { x: MARGIN, y: introY - 20, size: 9, font: bold, color: BRAND_BLUE });
  let scopeY = introY - 38;
  for (const item of scope) {
    cover.drawText("•", { x: MARGIN, y: scopeY, size: 9, font: bold, color: BRAND_BLUE });
    cover.drawText(item, { x: MARGIN + 14, y: scopeY, size: 9, font: regular, color: BRAND_DARK });
    scopeY -= 16;
  }

  drawFooter(cover, regular);

  // ── PAGES 2–5: Embed V7 report pages (position, pressure, video, notes) ─────
  const v7Doc = await PDFDocument.load(v7PdfBytes);
  const v7PageCount = v7Doc.getPageCount();
  // Skip cover page of V7 (page 0), embed pages 1 to end
  const pagesToEmbed = Math.min(v7PageCount - 1, 4);
  const embeddedPages = await doc.embedPdf(v7Doc, Array.from({ length: pagesToEmbed }, (_, i) => i + 1));

  for (let i = 0; i < embeddedPages.length; i++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const emb = embeddedPages[i];
    const scale = Math.min(PAGE_W / emb.width, (PAGE_H - 90) / emb.height);
    const w = emb.width * scale;
    const h = emb.height * scale;
    page.drawPage(emb, { x: (PAGE_W - w) / 2, y: (PAGE_H - 90 - h) / 2 + 30, width: w, height: h });
    drawHeader(page, bold, regular, riderName, date, sport, i + 2);
    drawFooter(page, regular);
  }

  let pageOffset = 1 + pagesToEmbed;

  // ── PAGE: Biomechanische Winkelwerte ─────────────────────────────────────────
  const bioPage = doc.addPage([PAGE_W, PAGE_H]);
  drawHeader(bioPage, bold, regular, riderName, date, sport, pageOffset + 1);
  drawFooter(bioPage, regular);
  pageOffset++;

  let y = PAGE_H - 70;
  y = drawSectionTitle(bioPage, bold, "Biomechanische Winkelanalyse", y);
  y -= 4;

  bioPage.drawText("Gelenkwinkel", { x: MARGIN, y, size: 8, font: bold, color: BRAND_DARK });
  y -= 6;
  if (velogicData.jointAngles.length > 0) {
    y = drawMetricsTable(bioPage, bold, regular, velogicData.jointAngles, y);
  }

  y -= 8;
  bioPage.drawText("Gelenkbewegung", { x: MARGIN, y, size: 8, font: bold, color: BRAND_DARK });
  y -= 6;
  if (velogicData.jointMotion.length > 0) {
    y = drawMetricsTable(bioPage, bold, regular, velogicData.jointMotion, y, " mm");
  }

  y -= 8;
  bioPage.drawText("Alignment", { x: MARGIN, y, size: 8, font: bold, color: BRAND_DARK });
  y -= 6;
  if (velogicData.alignment.length > 0) {
    y = drawMetricsTable(bioPage, bold, regular, velogicData.alignment, y, " mm");
  }

  // ── PAGE: Anthropometrie + Performance ───────────────────────────────────────
  const anthroPage = doc.addPage([PAGE_W, PAGE_H]);
  drawHeader(anthroPage, bold, regular, riderName, date, sport, pageOffset + 1);
  drawFooter(anthroPage, regular);
  pageOffset++;

  let y2 = PAGE_H - 70;
  y2 = drawSectionTitle(anthroPage, bold, "Anthropometrie", y2);
  y2 -= 4;
  if (velogicData.anthropometry.length > 0) {
    y2 = drawMetricsTable(anthroPage, bold, regular, velogicData.anthropometry, y2, " mm");
  }

  if (velogicData.performance.length > 0) {
    y2 -= 16;
    y2 = drawSectionTitle(anthroPage, bold, "Performance", y2);
    y2 -= 4;
    y2 = drawMetricsTable(anthroPage, bold, regular, velogicData.performance, y2, " rpm");
  }

  // Legend note
  y2 -= 24;
  anthroPage.drawText("Farbcode Änderung:", { x: MARGIN, y: y2, size: 8, font: bold, color: BRAND_DARK });
  anthroPage.drawText("+ Verbesserung", { x: MARGIN + 120, y: y2, size: 8, font: regular, color: GREEN });
  anthroPage.drawText("- Anpassung", { x: MARGIN + 220, y: y2, size: 8, font: regular, color: RED });
  anthroPage.drawText("= Unverändert", { x: MARGIN + 310, y: y2, size: 8, font: regular, color: MID_GRAY });

  return doc.save();
}
