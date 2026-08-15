import { NextResponse } from "next/server";

/**
 * /api/company-hr/evaluations/[id]/certificate
 *
 * DEPRECATED — this route was replaced by /api/company-hr/certificates
 * (which properly uploads a PDF file + generates a verification_code +
 * verification_url). The old route created certificate rows with NULL
 * file_url / verification_code, leaving students unable to download or
 * verify their certificates.
 *
 * Returns 410 Gone so any old client code gets a clear signal to
 * migrate to the new endpoint.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "This endpoint is deprecated. Use POST /api/company-hr/certificates instead.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "This endpoint is deprecated. Use GET /api/company-hr/certificates instead.",
    },
    { status: 410 }
  );
}
