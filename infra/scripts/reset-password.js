#!/usr/bin/env node

/**
 * Reset password for an existing user
 * Usage: node reset-password.js <email> <new-password>
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error("Usage: node reset-password.js <email> <new-password>");
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

async function resetPassword() {
  console.log(`Resetting password for: ${email}`);

  try {
    // Get user by email
    const user = await auth.getUserByEmail(email);
    console.log("Found user:", user.uid);

    // Update password
    await auth.updateUser(user.uid, {
      password: newPassword,
    });

    console.log("\n=== Password reset successfully! ===");
    console.log("Email:", email);
    console.log("New password:", newPassword);
  } catch (error) {
    console.error("Error resetting password:", error);
    process.exit(1);
  }
}

resetPassword()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
