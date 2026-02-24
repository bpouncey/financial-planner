import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * GET /api/supabase/test — verify Supabase connection.
 * Returns { ok, message } or error.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from("households").select("id").limit(1);

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({
          ok: false,
          message: "Table 'households' not found. Run the migration in Supabase SQL Editor.",
          hint: "See supabase/migrations/20250222000000_create_households.sql",
        });
      }
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Connected to Supabase. households table accessible.",
      rowCount: data?.length ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message },
      { status: 500 }
    );
  }
}
