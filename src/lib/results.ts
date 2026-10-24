/** Shared response contract: the server constrains generation; the client still
 * validates every field because compatible servers may ignore response_format. */
export interface EmailReply {
  title: string;
  body: string;
}
export interface EmailResult {
  summary: string;
  action_items: string[];
  replies: EmailReply[];
}

export const emailResultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "action_items", "replies"],
  properties: {
    summary: { type: "string", description: "A concise 2–3 sentence summary." },
    action_items: {
      type: "array",
      description:
        "Only supported tasks, with owners and dates when stated. Empty when none.",
      items: { type: "string" },
    },
    replies: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: {
          title: {
            type: "string",
            description: "A short label describing this reply option.",
          },
          body: {
            type: "string",
            description:
              "The complete reply in plain text, with paragraph breaks. No Markdown, HTML, title, or commentary.",
          },
        },
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasKeys(value: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Error messages never echo the model's response or the original email. */
export function parseEmailResult(content: string): EmailResult {
  let value: unknown;
  try {
    // Some prompted-JSON models wrap a valid object in a single Markdown fence.
    const json = content
      .trim()
      .replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
    value = JSON.parse(json);
  } catch {
    throw new Error(
      "The model did not return valid JSON. Try JSON Schema in Settings or use a model that supports JSON output.",
    );
  }
  if (
    !isRecord(value) ||
    !hasKeys(value, ["summary", "action_items", "replies"]) ||
    !isText(value.summary) ||
    !Array.isArray(value.action_items) ||
    !value.action_items.every(isText) ||
    !Array.isArray(value.replies) ||
    value.replies.length !== 2 ||
    !value.replies.every(
      (reply) =>
        isRecord(reply) &&
        hasKeys(reply, ["title", "body"]) &&
        isText(reply.title) &&
        isText(reply.body),
    )
  ) {
    throw new Error(
      "The model returned an invalid result structure. Expected a summary, an action-items array, and two replies with titles and bodies. Try JSON Schema or another model.",
    );
  }
  return {
    summary: value.summary.trim(),
    action_items: value.action_items.map((item: string) => item.trim()),
    replies: value.replies.map((reply: EmailReply) => ({
      title: reply.title.trim(),
      body: reply.body.trim(),
    })),
  };
}

/** Keep the original whole-result Markdown export alongside individual replies. */
export function resultMarkdown(result: EmailResult): string {
  return [
    "## Summary",
    result.summary,
    "## Action items",
    result.action_items.length
      ? result.action_items
          .map((item) => `- ${item.replace(/\n/g, "\n  ")}`)
          .join("\n")
      : "No action items identified.",
    "## Suggested replies",
    ...result.replies.map((reply) => `### ${reply.title}\n\n${reply.body}`),
  ].join("\n\n");
}
