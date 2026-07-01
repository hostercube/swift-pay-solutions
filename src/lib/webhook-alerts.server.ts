// Server-only helper to post messages to a merchant's Slack/Discord incoming webhook.
// Fires from notifications.server.ts — never throws.

async function post(url: string, body: unknown) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* swallow */
  }
}

export async function sendSlack(url: string, title: string, body: string) {
  await post(url, {
    text: title,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title } },
      { type: "section", text: { type: "mrkdwn", text: body || " " } },
      { type: "context", elements: [{ type: "mrkdwn", text: "_PayNOC alert_" }] },
    ],
  });
}

export async function sendDiscord(url: string, title: string, body: string) {
  await post(url, {
    embeds: [
      {
        title,
        description: body || " ",
        color: 0x6366f1,
        footer: { text: "PayNOC" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
