import { NextResponse } from "next/server";

/** Lightweight liveness for Render health checks (no DB / no auth). */
export async function GET() {
  return NextResponse.json({ ok: true, service: "roam-web" });
}
