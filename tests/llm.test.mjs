import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  baseUrl,
  defaults,
  loadModels,
  summarize,
  readSettings,
  request,
} from "../src/lib/llm.ts";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "localStorage", {
    value: originalStorage,
    configurable: true,
  });
});
const signal = () => new AbortController().signal;
const result = {
  summary: "A summary. More detail.",
  action_items: [],
  replies: [
    { title: "Confirm", body: "Thanks for the update.\n\nI will review it." },
    { title: "Clarify", body: "Could you confirm the deadline?" },
  ],
};

test("builds loopback, LAN, HTTPS, default-port, custom-path and IPv6 URLs", () => {
  assert.equal(baseUrl(defaults), "http://127.0.0.1:1234/v1");
  assert.equal(
    baseUrl({ ...defaults, host: "192.168.1.12", port: "11434" }),
    "http://192.168.1.12:11434/v1",
  );
  assert.equal(
    baseUrl({
      ...defaults,
      protocol: "https",
      host: "llm.local",
      port: "",
      path: "/api/v1/",
    }),
    "https://llm.local/api/v1",
  );
  assert.equal(baseUrl({ ...defaults, host: "[::1]" }), "http://[::1]:1234/v1");
});
test("rejects malformed server addresses, ports, and paths", () => {
  for (const host of [
    "",
    "http://localhost",
    "host/path",
    "user@host",
    "host?secret=1",
    "host:1234",
  ])
    assert.throws(() => baseUrl({ ...defaults, host }));
  for (const port of ["0", "-1", "65536", "abc"])
    assert.throws(() => baseUrl({ ...defaults, port }));
  for (const path of ["v1", "/v1?key=secret", "/v1#secret", "/a b", "/a\\b"])
    assert.throws(() => baseUrl({ ...defaults, path }));
});
test("discovers unique sorted model IDs, skipping malformed entries", async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, "http://127.0.0.1:1234/v1/models");
    return Response.json({
      data: [
        { id: "z-model" },
        { id: "a-model" },
        { id: "z-model" },
        { id: 2 },
        null,
      ],
    });
  };
  assert.deepEqual(await loadModels(defaults, signal()), [
    "a-model",
    "z-model",
  ]);
});
test("explains empty or unsupported model lists", async () => {
  globalThis.fetch = async () => Response.json({ data: [] });
  await assert.rejects(loadModels(defaults, signal()), /No models/);
  globalThis.fetch = async () => Response.json({ models: [] });
  await assert.rejects(loadModels(defaults, signal()), /manually/);
});
test("sends email only to the configured server with selected model and tone", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://192.168.1.20:1234/v1/chat/completions");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, "Bearer session-secret");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "my-model");
    assert.equal(body.stream, false);
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema.required, [
      "summary",
      "action_items",
      "replies",
    ]);
    assert.match(body.messages[0].content, /friendly/);
    assert.match(body.messages[0].content, /untrusted data/);
    assert.match(body.messages[1].content, /Private email/);
    return Response.json({
      choices: [{ message: { content: JSON.stringify(result) } }],
    });
  };
  assert.deepEqual(
    await summarize(
      {
        ...defaults,
        host: "192.168.1.20",
        model: "my-model",
        apiKey: "session-secret",
      },
      "Private email",
      "Friendly",
      signal(),
    ),
    result,
  );
});
test("rejects missing models before sending email", async () => {
  globalThis.fetch = () => {
    assert.fail("No request should occur");
  };
  await assert.rejects(
    summarize(defaults, "private", "Concise", signal()),
    /Choose a model/,
  );
});
test("handles HTTP errors without displaying echoed private content", async () => {
  globalThis.fetch = async () =>
    Response.json({ error: "PRIVATE EMAIL" }, { status: 401 });
  await assert.rejects(
    request(defaults, "/models", signal()),
    (error) =>
      /HTTP 401/.test(error.message) &&
      !error.message.includes("PRIVATE EMAIL"),
  );
});
test("detects empty and truncated completions", async () => {
  globalThis.fetch = async () =>
    Response.json({ choices: [{ message: { content: "" } }] });
  await assert.rejects(
    summarize({ ...defaults, model: "test" }, "email", "Friendly", signal()),
    /no text/,
  );
  globalThis.fetch = async () =>
    Response.json({
      choices: [{ message: { content: "Partial" }, finish_reason: "length" }],
    });
  await assert.rejects(
    summarize({ ...defaults, model: "test" }, "email", "Friendly", signal()),
    /truncated/,
  );
});
test("restores only allowlisted preferences and never a persisted API key", () => {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: () =>
        JSON.stringify({
          host: "llm.local",
          model: "test",
          apiKey: "must-not-restore",
          port: 4,
        }),
    },
    configurable: true,
  });
  assert.deepEqual(readSettings(), {
    ...defaults,
    host: "llm.local",
    model: "test",
  });
});
test("falls back safely when browser storage is blocked", () => {
  Object.defineProperty(globalThis, "localStorage", {
    get() {
      throw new Error("Blocked");
    },
    configurable: true,
  });
  assert.deepEqual(readSettings(), defaults);
});

test("supports explicit JSON mode and prompted JSON without automatic retries", async () => {
  for (const outputMode of ["json_object", "prompt"]) {
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      if (outputMode === "prompt")
        assert.ok(!Object.hasOwn(body, "response_format"));
      else assert.deepEqual(body.response_format, { type: "json_object" });
      assert.match(body.messages[0].content, /JSON/);
      return Response.json({
        choices: [{ message: { content: JSON.stringify(result) } }],
      });
    };
    assert.deepEqual(
      await summarize(
        { ...defaults, model: "test", outputMode },
        "email",
        "Friendly",
        signal(),
      ),
      result,
    );
    assert.equal(calls, 1);
  }
});
test("explains unsupported structured output without silently resending email", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ error: "PRIVATE_EMAIL" }, { status: 400 });
  };
  await assert.rejects(
    summarize({ ...defaults, model: "test" }, "email", "Friendly", signal()),
    /JSON mode or Prompted JSON/,
  );
  assert.equal(calls, 1);
});
test("rejects refusals without exposing refusal contents", async () => {
  globalThis.fetch = async () =>
    Response.json({ choices: [{ message: { refusal: "PRIVATE_EMAIL" } }] });
  await assert.rejects(
    summarize({ ...defaults, model: "test" }, "email", "Friendly", signal()),
    (error) =>
      /declined/.test(error.message) &&
      !error.message.includes("PRIVATE_EMAIL"),
  );
});
