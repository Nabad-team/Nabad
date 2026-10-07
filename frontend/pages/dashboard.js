import Head from "next/head";
import ProfileHeader from "../components/ProfileHeader";
import EmailVerificationBanner from "../components/EmailVerificationBanner";
import { useActiveProfile } from "../context/ActiveProfileContext";

const TEAL = "#0f766e";

const buttonStyle = {
  display: "inline-block",
  padding: "10px 20px",
  borderRadius: 8,
  background: TEAL,
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
};

function MicrophoneIcon() {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" />
    </svg>
  );
}

export default function DashboardPage() {
  // The active profile (you or a dependent) is loaded by ActiveProfileProvider in _app.js.
  const { activeProfile, error, loading } = useActiveProfile();

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px", fontFamily: "sans-serif", color: "#1f2937" }}>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <ProfileHeader />
      <EmailVerificationBanner />
      {activeProfile && <h1>Welcome, {activeProfile.fullName}</h1>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      <a
        href="/symptoms"
        aria-label="Speak your symptoms"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          margin: "24px 0",
          padding: 20,
          borderRadius: 12,
          background: "#f0fdfa",
          border: `2px solid ${TEAL}`,
          color: TEAL,
          textDecoration: "none",
        }}
      >
        <MicrophoneIcon />
        <span>
          <strong style={{ display: "block", fontSize: 20 }}>
            Speak your symptoms
          </strong>
          <span>Tap here to describe how you feel by voice.</span>
        </span>
      </a>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/profile" style={buttonStyle}>My Profile</a>
        <a href="/security" style={buttonStyle}>Security</a>
      </div>
    </main>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
DashboardPage.requireSignIn = true;
