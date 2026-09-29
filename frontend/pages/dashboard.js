import Head from "next/head";
import ProfileHeader from "../components/ProfileHeader";
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

export default function DashboardPage() {
  // The active profile (you or a dependent) is loaded by ActiveProfileProvider in _app.js.
  const { activeProfile, error, loading } = useActiveProfile();

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px", fontFamily: "sans-serif", color: "#1f2937" }}>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <ProfileHeader />
      {activeProfile && <h1>Welcome, {activeProfile.fullName}</h1>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>Loading...</p>}
      <a href="/profile" style={buttonStyle}>My Profile</a>
    </main>
  );
}

// Health data: only for signed-in users (see components/RequireSignIn.js).
DashboardPage.requireSignIn = true;
