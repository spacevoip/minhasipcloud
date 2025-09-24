import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  // Add PABX context to the API error
  Sentry.setContext("PABX API", {
    endpoint: "/api/sentry-example-api",
    method: "GET",
    userAgent: request.headers.get("user-agent"),
    timestamp: new Date().toISOString(),
  });

  Sentry.setTag("api.type", "sentry-test");
  Sentry.setTag("system", "pabx");

  // Add breadcrumb
  Sentry.addBreadcrumb({
    message: "Sentry example API called",
    category: "api",
    level: "info",
    data: {
      url: request.url,
      method: "GET",
    },
  });

  console.log("API Route called: /api/sentry-example-api");

  // This will trigger a backend error that Sentry will capture
  throw new Error("Sentry Backend Error - PABX API Test");
}
