import { NextRequest, NextResponse } from "next/server";
import { generateDataPages } from "@/lib/generateReport";
import type { VelogicData } from "@/lib/parseVelogic";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const velogicData: VelogicData = body;

    if (!velogicData?.riderName) {
      return NextResponse.json({ error: "Keine gültigen Velogic-Daten erhalten." }, { status: 400 });
    }

    const pdfBytes = await generateDataPages(velogicData);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Report generation error:", msg);
    return NextResponse.json({ error: `Report-Fehler: ${msg}` }, { status: 500 });
  }
}
