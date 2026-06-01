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
    console.error("Report generation error:", err);
    return NextResponse.json({ error: "Fehler bei der Report-Erstellung." }, { status: 500 });
  }
}
