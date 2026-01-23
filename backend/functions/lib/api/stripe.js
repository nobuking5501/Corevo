"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
exports.stripeWebhook = (0, https_1.onRequest)({ region: "asia-northeast1" }, async (req, res) => {
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
    }
    catch (error) {
        console.error("Webhook error:", error);
        res.status(400).send({ error: error.message });
    }
});
async function handleSubscriptionChange(subscription) {
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
//# sourceMappingURL=stripe.js.map