import { NextRequest, NextResponse } from "next/server";
import { generateUnifiedReport } from "@/lib/generateReport";
import type { VelogicData } from "@/lib/parseVelogic";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const velogicJson = formData.get("velogicData") as string | null;
    const v7File = formData.get("v7") as File | null;

    if (!velogicJson || !v7File) {
      return NextResponse.json({ error: "Velogic-Daten und V7-PDF werden benötigt." }, { status: 400 });
    }

    const velogicData: VelogicData = JSON.parse(velogicJson);
    const v7Buffer = new Uint8Array(await v7File.arrayBuffer());

    const reportBytes = await generateUnifiedReport(velogicData, v7Buffer);

    const safeName = (velogicData.riderName || "Report").replace(/[^a-zA-Z0-9_\-]/g, "_");
    return new NextResponse(Buffer.from(reportBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gebioMized_FitReport_${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json({ error: "Fehler bei der Report-Erstellung." }, { status: 500 });
  }
}
