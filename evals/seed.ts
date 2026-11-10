import { ensureUser, saveMessage, saveSources, getDb } from "../src/memory/db";

export const EVAL_USER_ID = "user_eval_dataset";

export function seedEvalData(targetUserId: string = EVAL_USER_ID) {
  ensureUser(targetUserId, "UTC");
  getDb().prepare("DELETE FROM messages WHERE user_id = ?").run(targetUserId);

  // Turn 1: 3 November 2026 - Postgres Hosting Discussion
  const msgNov3User = `msg_${targetUserId}_nov3_user`;
  const msgNov3Assistant = `msg_${targetUserId}_nov3_asst`;

  saveMessage({
    id: msgNov3User,
    userId: targetUserId,
    role: "user",
    content:
      "What are the best Postgres hosting options for a high-availability production app?",
    createdAt: "2026-11-03T10:15:00.000Z",
  });

  saveMessage({
    id: msgNov3Assistant,
    userId: targetUserId,
    role: "assistant",
    content:
      "For managed Postgres hosting: 1) Supabase Pro ($25/mo) provides built-in connection pooling and auth. 2) Neon ($19/mo) offers serverless autoscaling and branching. 3) AWS RDS Multi-AZ offers enterprise SLAs.",
    createdAt: "2026-11-03T10:15:30.000Z",
  });

  saveSources([
    {
      messageId: msgNov3Assistant,
      url: "https://supabase.com/pricing",
      title: "Supabase Pricing & Features",
      publishedAt: "2026-10-15",
    },
    {
      messageId: msgNov3Assistant,
      url: "https://neon.tech/pricing",
      title: "Neon Serverless Postgres Pricing",
      publishedAt: "2026-10-20",
    },
  ]);

  // Turn 2: Monday 9 November 2026 - 5 CRM Tools Shortlist
  const msgMonUser = `msg_${targetUserId}_mon_user`;
  const msgMonAssistant = `msg_${targetUserId}_mon_asst`;

  saveMessage({
    id: msgMonUser,
    userId: targetUserId,
    role: "user",
    content:
      "We need to shortlist 5 CRM tools for a 20-person sales team. What are the best options?",
    createdAt: "2026-11-09T14:00:00.000Z",
  });

  saveMessage({
    id: msgMonAssistant,
    userId: targetUserId,
    role: "assistant",
    content:
      "Here is the shortlist of 5 CRM tools for a 20-person team: 1) HubSpot Sales Hub Professional ($500/mo for 5 seats + $100/seat). 2) Salesforce Sales Cloud Enterprise ($165/user/mo). 3) Pipedrive Professional ($49.90/user/mo). 4) Close CRM Business ($149/user/mo). 5) Zoho CRM Enterprise ($40/user/mo).",
    createdAt: "2026-11-09T14:00:45.000Z",
  });

  saveSources([
    {
      messageId: msgMonAssistant,
      url: "https://www.hubspot.com/pricing/sales",
      title: "HubSpot Sales Hub Pricing",
      publishedAt: "2026-11-01",
    },
    {
      messageId: msgMonAssistant,
      url: "https://www.salesforce.com/editions-pricing/sales-cloud/",
      title: "Salesforce Sales Cloud Pricing",
      publishedAt: "2026-10-28",
    },
  ]);
}

if (require.main === module) {
  seedEvalData();
  console.log("Evaluation conversation history seeded successfully. ✅");
}
