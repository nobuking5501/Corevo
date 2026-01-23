import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

export const stripeWebhook = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    // In production, verify Stripe signature
    // const sig = req.headers["stripe-signature"];

    try {
      const event = req.body;

      switch (event.type) {
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await handleSubscriptionChange(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.status(200).send({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).send({ error: error.message });
    }
  }
);

async function handleSubscriptionChange(subscription: any) {
  const db = admin.firestore();
  const customerId = subscription.customer;

  // Find tenant by Stripe customer ID
  const tenantsSnap = await db.collection("tenants").where("stripeCustomerId", "==", customerId).get();

  if (tenantsSnap.empty) {
    console.error("Tenant not found for Stripe customer:", customerId);
    return;
  }

  const tenantDoc = tenantsSnap.docs[0];
  const tenantId = tenantDoc.id;

  // Update tenant plan and settings
  const plan = subscription.items.data[0]?.price?.lookup_key || "basic";
  const status = subscription.status === "active" ? "active" : "suspended";

  await tenantDoc.ref.update({
    plan,
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update feature flags based on plan
  const featureFlags = {
    aiAutoSuggest: ["pro", "enterprise"].includes(plan),
    lineIntegration: ["enterprise"].includes(plan),
    advancedAnalytics: ["pro", "enterprise"].includes(plan),
  };

  await db.collection(`tenants/${tenantId}/settings`).doc("main").update({
    featureFlags,
    "billingStatus.plan": plan,
    "billingStatus.periodEnd": new Date(subscription.current_period_end * 1000),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
