import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "20px",
      background: "linear-gradient(135deg, #06070e 0%, #0b0c18 100%)",
    }}>
      <SignIn />
    </main>
  );
}