#!/usr/bin/env node

/**
 * Force refresh custom claims for a user
 * This ensures the claims are properly set and forces all existing sessions to refresh
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const [email] = process.argv.slice(2);

if (!email) {
  console.error("Usage: node force-refresh-claims.js <email>");
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || "./service-account-key.json";

try {
  const serviceAccountData = JSON.parse(readFileSync(serviceAccount, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountData),
  });
} catch (error) {
  console.error("Error initializing Firebase Admin:", error.message);
  process.exit(1);
}

const auth = admin.auth();

async function forceRefreshClaims() {
  console.log(`Force refreshing claims for: ${email}\n`);

  try {
    // Get user
    const user = await auth.getUserByEmail(email);
    console.log("User ID:", user.uid);

    // Get current claims
    const currentClaims = user.customClaims || {};
    console.log("Current claims:", JSON.stringify(currentClaims, null, 2));

    // Re-set the same claims (this forces a refresh)
    await auth.setCustomUserClaims(user.uid, currentClaims);
    console.log("\n✅ Claims refreshed!");

    // Revoke all refresh tokens to force clients to get new ID tokens
    await auth.revokeRefreshTokens(user.uid);
    console.log("✅ Revoked all refresh tokens - all sessions will get new ID tokens on next request");

    console.log("\n=== Next Steps ===");
    console.log("1. User must log out and log back in");
    console.log("2. Or wait for automatic token refresh (may take a few minutes)");
    console.log("3. Or use the fix-auth.html page to clear cache and re-login");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

forceRefreshClaims()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
