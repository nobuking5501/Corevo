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
exports.nbaJob = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
exports.nbaJob = (0, scheduler_1.onSchedule)({
    schedule: "0 4 * * *", // Daily at 04:00 JST
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
}, async () => {
    console.log("Starting NBA (Next Best Action) suggestion job");
    const db = admin.firestore();
    try {
        const tenantsSnap = await db.collection("tenants").where("status", "==", "active").get();
        for (const tenantDoc of tenantsSnap.docs) {
            const tenantId = tenantDoc.id;
            try {
                await generateNBASuggestions(tenantId);
            }
            catch (error) {
                console.error(`Error generating NBA suggestions for tenant ${tenantId}:`, error);
            }
        }
        console.log("NBA suggestion job completed");
    }
    catch (error) {
        console.error("NBA job error:", error);
    }
});
async function generateNBASuggestions(tenantId) {
    const db = admin.firestore();
    // Get customers who haven't visited recently
    const customersSnap = await db
        .collection(`tenants/${tenantId}/customers`)
        .where("lastVisit", "<", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .limit(10)
        .get();
    if (customersSnap.empty) {
        console.log(`No inactive customers found for tenant ${tenantId}`);
        return;
    }
    let suggestionsCreated = 0;
    for (const customerDoc of customersSnap.docs) {
        const customer = customerDoc.data();
        // Check if suggestion already exists
        const existingSuggestionsSnap = await db
            .collection(`tenants/${tenantId}/ai_suggestions`)
            .where("customerId", "==", customerDoc.id)
            .where("approved", "==", false)
            .where("sentAt", "==", null)
            .get();
        if (!existingSuggestionsSnap.empty) {
            continue; // Skip if suggestion already exists
        }
        // Generate suggestion
        const daysSinceLastVisit = customer.lastVisit
            ? Math.floor((Date.now() - customer.lastVisit.toDate().getTime()) / (1000 * 60 * 60 * 24))
            : 999;
        const messageBody = `${customer.name}様、こんにちは！前回のご来店から${daysSinceLastVisit}日が経ちました。
次回のご予約はいかがでしょうか？お待ちしております。`;
        const reason = `来店間隔: ${daysSinceLastVisit}日（目安: ${customer.visitInterval || 30}日）`;
        await db.collection(`tenants/${tenantId}/ai_suggestions`).add({
            tenantId,
            customerId: customerDoc.id,
            messageBody,
            reason,
            scheduledAt: new Date(),
            approved: false,
            priority: Math.min(10, Math.floor(daysSinceLastVisit / 10)),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        suggestionsCreated++;
        if (suggestionsCreated >= 5)
            break; // Limit to 5 suggestions per run
    }
    console.log(`Generated ${suggestionsCreated} NBA suggestions for tenant ${tenantId}`);
}
//# sourceMappingURL=nbaJob.js.map