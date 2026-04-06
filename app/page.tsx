import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "20px",
      background: "linear-gradient(135deg, #06070e 0%, #0b0c18 100%)",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: "linear-gradient(135deg, #4f7fff, #00d4a8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, margin: "0 auto 24px",
        }}>💸</div>
        <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 800, marginBottom: 12 }}>
          Sub<span style={{ color: "#00d4a8" }}>Zero</span>
        </h1>
        <p style={{ color: "#8080a0", fontSize: 17, marginBottom: 36, lineHeight: 1.6 }}>
          Stop wasting money on subscriptions you don&apos;t use.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/sign-up" style={{
            background: "linear-gradient(135deg, #4f7fff, #3a60cc)",
            color: "#fff", padding: "14px 32px", borderRadius: 12,
            fontWeight: 700, fontSize: 16, textDecoration: "none",
          }}>Get Started Free →</Link>
          <Link href="/sign-in" style={{
            background: "rgba(255,255,255,.06)", border: "1.5px solid rgba(255,255,255,.12)",
            color: "#f2f2fc", padding: "14px 32px", borderRadius: 12,
            fontWeight: 600, fontSize: 16, textDecoration: "none",
          }}>Sign In</Link>
        </div>
      </div>
    </main>
  );
}