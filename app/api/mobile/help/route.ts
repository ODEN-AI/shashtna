import { FAQ, TROUBLESHOOTING } from "@/src/content/help";
import { ok, withPublic } from "@/src/server/mobile/http";
import { supportChannels } from "@/src/server/mobile/shape";
import { TICKET_CATEGORIES } from "@/src/server/tickets";

export const dynamic = "force-dynamic";

/** Help centre content (same as the website's /help) and the support channels from Admin → Settings. */
export const GET = withPublic(async () =>
  ok({
    faq: FAQ.map((item) => ({ id: item.id, topic: item.topic, question: item.q.ar, answer: item.a.ar })),
    troubleshooting: TROUBLESHOOTING.map((guide) => ({
      id: guide.id,
      category: guide.category,
      title: guide.title.ar,
      symptoms: guide.symptoms.ar,
      steps: guide.steps.map((step) => step.ar),
    })),
    categories: TICKET_CATEGORIES.map((category) => ({ value: category.value, label: category.ar })),
    support: await supportChannels(),
  }),
);
