"use client";

import Head from "next/head";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  // Explicit client-side pageload transaction to populate Sentry "Client" tab
  useEffect(() => {
    Sentry.startSpan({ name: "Client Pageload Test", op: "pageload" }, async () => {
      // Simulate small client work
      await new Promise((r) => setTimeout(r, 200));
    });
  }, []);
  return (
    <div>
      <Head>
        <title>Sentry Onboarding</title>
        <meta name="description" content="Test Sentry for your Next.js app!" />
      </Head>

      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "3rem",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            textAlign: "center",
            maxWidth: "600px",
            margin: "2rem",
          }}
        >
          <h1
            style={{
              fontSize: "3rem",
              marginBottom: "1rem",
              color: "#1f2937",
              fontWeight: "bold",
            }}
          >
            🔍 Sentry Example
          </h1>
          
          <p
            style={{
              fontSize: "1.2rem",
              color: "#6b7280",
              marginBottom: "2rem",
              lineHeight: "1.6",
            }}
          >
            Get started by sending us a sample error for your PABX system:
          </p>
          
          <button
            type="button"
            style={{
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "1rem 2rem",
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s",
            }}
            onClick={async () => {
              // Set PABX context
              Sentry.setContext("PABX System", {
                component: "sentry-example",
                userRole: "admin",
                testType: "official",
                timestamp: new Date().toISOString(),
              });

              // Add breadcrumb
              Sentry.addBreadcrumb({
                message: "User clicked test button",
                category: "ui",
                level: "info",
              });

              // 1) Send a guaranteed frontend error to Sentry and wait for delivery
              Sentry.captureException(new Error("Sentry Frontend Error - PABX System Test"));
              // Give the SDK a brief moment to send the event before anything else happens
              // (especially useful in dev where overlays can interrupt)
              try {
                // flush returns a promise; 2000ms is usually enough
                // if it times out, we still proceed with the API test
                // @ts-ignore - types may vary per SDK version
                await Sentry.flush?.(2000);
              } catch {}

              // 2) Also trigger the backend error via API (optional for onboarding)
              try {
                await Sentry.startSpan(
                  { name: "API Call to sentry-example-api", op: "http.client" },
                  async () => {
                    const response = await fetch("/api/sentry-example-api");
                    if (!response.ok) {
                      throw new Error(`API returned ${response.status}`);
                    }
                    await response.json();
                  }
                );
              } catch (apiErr) {
                Sentry.captureException(apiErr);
              }

              // Do not throw unhandled error here to avoid interrupting event delivery
              alert("Erro de teste enviado ao Sentry. Verifique o dashboard.");
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#b91c1c";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#dc2626";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            🚨 Throw error!
          </button>

          {/* Button to force a client-side interaction transaction */}
          <button
            type="button"
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "0.8rem 1.6rem",
              fontSize: "1.05rem",
              fontWeight: "bold",
              cursor: "pointer",
              marginLeft: "1rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              transition: "all 0.2s",
            }}
            onClick={async () => {
              await Sentry.startSpan(
                { name: "Client Interaction Test", op: "ui.action.click" },
                async () => {
                  // Simulate some client work
                  await new Promise((r) => setTimeout(r, 300));
                }
              );
              alert("Transação de Client enviada. Veja a aba Client no Sentry.");
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#1d4ed8";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            ⚡ Client Transaction Test
          </button>

          <div
            style={{
              marginTop: "2rem",
              padding: "1.5rem",
              backgroundColor: "#f3f4f6",
              borderRadius: "8px",
              textAlign: "left",
            }}
          >
            <h3 style={{ margin: "0 0 1rem 0", color: "#374151" }}>
              📋 What this test does:
            </h3>
            <ul style={{ margin: 0, color: "#6b7280", lineHeight: "1.6" }}>
              <li>✅ Triggers a <strong>frontend error</strong></li>
              <li>✅ Makes an API call that triggers a <strong>backend error</strong></li>
              <li>✅ Creates a <strong>performance trace</strong></li>
              <li>✅ Adds <strong>PABX-specific context</strong></li>
            </ul>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#dbeafe",
              borderRadius: "6px",
              border: "1px solid #93c5fd",
            }}
          >
            <p style={{ margin: 0, color: "#1e40af", fontSize: "0.9rem" }}>
              💡 <strong>Next:</strong> Check your Sentry dashboard to see the captured errors and performance data!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
