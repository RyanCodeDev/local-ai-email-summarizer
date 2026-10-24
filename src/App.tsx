import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Copy,
  FileText,
  Inbox,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  WandSparkles,
  Zap,
} from "lucide-react";
import { ResultSections } from "./ResultSections";
import { resultMarkdown } from "./lib/results";
import type { EmailResult } from "./lib/results";
import { SettingsModal } from "./SettingsModal";
import { connectionError, readSettings, summarize } from "./lib/llm";
import "./App.css";

const SAMPLE = `Subject: Website refresh — next steps before Friday

Hi Alex,

Thanks for all your work on the website refresh. The team reviewed the latest designs this morning and we're happy with the overall direction. The updated navigation and product pages look great.

There are a few things we need to wrap up before we can move into development. Could you send the final homepage mockups by Thursday afternoon? We also need your feedback on the revised pricing page copy; I've shared it in our project folder. Please flag any changes by Friday at noon.

On our side, Maya will prepare the image assets and send them over by Wednesday. The development team is aiming to kick things off next Monday, so it would be helpful to have everything approved before the weekend.

Would you be available for a quick 20-minute check-in on Friday at 2 PM to go through any open questions? Let me know if another time works better.

Thanks again,
Jamie`;

type CopyFormat = "Rich HTML" | "Plain text" | "Markdown";
/** Preserve block and list boundaries when copying rendered results as plain text. */
function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("li").forEach((node) => node.prepend("• "));
  doc
    .querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,ul,ol,blockquote,pre,tr")
    .forEach((node) => node.append("\n"));
  doc.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function App() {
  const [settings, setSettings] = useState(readSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [tone, setTone] = useState("Professional");
  const [result, setResult] = useState<EmailResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [source, setSource] = useState(false);
  const [copyFormat, setCopyFormat] = useState<CopyFormat>("Rich HTML");
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const words = email.trim() ? email.trim().split(/\s+/).length : 0;
  function clear() {
    abort.current?.abort();
    setBusy(false);
    setEmail("");
    setResult(null);
    setError("");
    setNotice("Workspace cleared");
    input.current?.focus();
  }
  // Each run owns its controller. Aborted or superseded runs cannot update the UI.
  async function generate() {
    if (!email.trim() || busy) return;
    if (!settings.model) {
      setSettingsOpen(true);
      return;
    }
    const active = new AbortController();
    abort.current = active;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const output = await summarize(
        settings,
        email,
        tone,
        AbortSignal.any([active.signal, AbortSignal.timeout(180000)]),
      );
      if (!active.signal.aborted) {
        setResult(output);
        setConnected(true);
        setSource(false);
        setNotice("Summary and reply drafts ready");
      }
    } catch (err) {
      if (!active.signal.aborted) {
        setError(connectionError(err));
        setConnected(false);
      }
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  }
  function cancel() {
    abort.current?.abort();
    setBusy(false);
    setNotice("Generation stopped");
  }
  async function copy() {
    if (!result) return;
    try {
      const html = renderToStaticMarkup(<ResultSections result={result} />);
      if (copyFormat === "Rich HTML") {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
          throw new Error(
            "Rich HTML copying is unavailable in this browser. Choose Markdown or plain text, or open the app on localhost / HTTPS.",
          );
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plainText(html)], { type: "text/plain" }),
          }),
        ]);
      } else {
        if (!navigator.clipboard?.writeText)
          throw new Error(
            "Clipboard access requires localhost or HTTPS. You can select and copy the output manually.",
          );
        await navigator.clipboard.writeText(
          copyFormat === "Markdown" ? resultMarkdown(result) : plainText(html),
        );
      }
      setNotice(`Copied as ${copyFormat.toLowerCase()}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Clipboard access was denied. Check browser permissions or copy the output manually.",
      );
    }
  }
  async function copyReply(body: string, index: number) {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error(
          "Clipboard access requires localhost or HTTPS. You can select and copy the reply manually.",
        );
      // Copy the body directly: no title, Markdown conversion, HTML, or other replies.
      await navigator.clipboard.writeText(body);
      setError("");
      setNotice(`Reply ${index + 1} copied as plain text`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Clipboard access was denied. Select and copy the reply manually.",
      );
    }
  }
  return (
    <div className="app-shell">
      <div className="main-shell">
        <header className="topbar">
          <a className="wordmark" href="#main">
            <h1>
              Local AI
              <br className="mobile-break" /> <span>Email Summarizer</span>
            </h1>
          </a>
          <div className="topbar-right">
            <span className="privacy-label">
              <ShieldCheck size={15} /> Private by design
            </span>
            <span className="topbar-separator" />
            <button
              className="server-pill"
              onClick={() => setSettingsOpen(true)}
            >
              <span className={`status-dot ${connected ? "online" : ""}`} />
              {connected ? "Server connected" : "Configure server"}
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main id="main">
          <section className="intro">
            <div>

              <p>
                Your private AI workspace for turning emails into summaries,
                actions, and thoughtful replies.
              </p>
            </div>
            <div className="local-badge">
              <div className="local-badge-icon">
                <LockKeyhole size={20} />
              </div>
              <div>
                <strong>Your server. Your data.</strong>
                <span>No cloud AI. No email storage.</span>
              </div>
            </div>
          </section>
          <div className="workspace">
            <section
              className="panel email-panel"
              aria-labelledby="email-heading"
            >
              <header className="panel-header">
                <div className="panel-title">
                  <span className="panel-icon">
                    <Mail size={18} />
                  </span>
                  <h2 id="email-heading">Your email</h2>
                  <span className="step-number">01</span>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setEmail(SAMPLE);
                    setResult(null);
                    setError("");
                    input.current?.focus();
                  }}
                  disabled={busy}
                >
                  <FileText size={14} /> Try an example <ArrowRight size={13} />
                </button>
              </header>
              <div className="input-area">
                <label className="sr-only" htmlFor="email">
                  Paste your email content
                </label>
                <textarea
                  id="email"
                  ref={input}
                  value={email}
                  disabled={busy}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setResult(null);
                    setError("");
                  }}
                  placeholder={
                    "Paste your email here…\n\nA lengthy update, a project thread, or that email you’ve been putting off. Let’s make sense of it."
                  }
                />
                {!email && (
                  <div className="input-hint">
                    <Clipboard size={14} />
                    <span>Just the text. No inbox access needed.</span>
                  </div>
                )}
              </div>
              <div className="input-stats">
                <span>
                  {words.toLocaleString()} words{" "}
                  <span className="stat-dot">·</span>{" "}
                  {email.length.toLocaleString()} characters
                </span>
                <button
                  className="icon-button"
                  disabled={busy || !email}
                  onClick={() => {
                    setEmail("");
                    setResult(null);
                    setError("");
                    input.current?.focus();
                  }}
                  aria-label="Clear email"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <footer className="input-footer">
                <label className="tone-control">
                  <span>Reply tone</span>
                  <select
                    value={tone}
                    disabled={busy}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    <option>Professional</option>
                    <option>Friendly</option>
                    <option>Concise</option>
                  </select>
                </label>
                {busy ? (
                  <button className="primary-button" onClick={cancel}>
                    <Square size={15} /> Stop generation
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled={!email.trim()}
                    onClick={generate}
                  >
                    <Sparkles size={17} /> Summarize email{" "}
                    <ArrowRight size={16} />
                  </button>
                )}
              </footer>
            </section>
            <section
              className={`panel result-panel ${result ? "has-result" : ""}`}
              aria-labelledby="result-heading"
            >
              <header className="panel-header">
                <div className="panel-title">
                  <span className="panel-icon accent">
                    <WandSparkles size={18} />
                  </span>
                  <h2 id="result-heading">AI Summary</h2>
                  <span className="step-number">02</span>
                </div>
                <button
                  className="text-button"
                  onClick={() => setSettingsOpen(true)}
                >
                  Manage connection <Settings size={14} />
                </button>
                <div className="output-switch" aria-label="Output view">
                  <button
                    aria-label="Rendered output"
                    title="Rendered output"
                    aria-pressed={!source}
                    disabled={!result}
                    className={!source ? "selected" : ""}
                    onClick={() => setSource(false)}
                  >
                    <FileText size={15} />
                  </button>
                  <button
                    aria-label="Markdown source"
                    title="Markdown source"
                    aria-pressed={source}
                    disabled={!result}
                    className={source ? "selected" : ""}
                    onClick={() => setSource(true)}
                  >
                    <Code2 size={17} />
                  </button>
                </div>
              </header>
              <div className="result-body" aria-busy={busy}>
                {busy ? (
                  <div className="empty-state">
                    <div className="ai-orbit processing">
                      <LoaderCircle size={30} className="spin" />
                    </div>
                    <h3>Local AI is on it!</h3>
                    <p>
                      Your server is working on the email.
                    </p>
                    <span className="processing-note">
                      Processing on your configured server
                    </span>
                  </div>
                ) : result ? (
                  source ? (
                    <pre className="markdown-source">
                      {resultMarkdown(result)}
                    </pre>
                  ) : (
                    <div className="markdown-output">
                      <ResultSections result={result} onCopyReply={copyReply} />
                    </div>
                  )
                ) : (
                  <div className="empty-state">
                    <div className="ai-orbit">
                      <Sparkles size={30} />
                      <span className="orbit-point" />
                    </div>
                    <h3>
                      A little less reading.
                      <br />A lot more clarity.
                    </h3>
                    <p>
                      Paste an email and let your local AI
                      <br />
                      bring the important things into focus.
                    </p>
                    <div className="output-features">
                      <span>
                        <FileText size={13} /> Summary
                      </span>
                      <span>
                        <ListChecks size={14} /> Action items
                      </span>
                      <span>
                        <MessageSquare size={13} /> Replies
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <footer className="output-footer">
                <span className="output-note">
                  <span className={`status-dot ${result ? "online" : ""}`} />
                  {busy
                    ? "Working locally"
                    : result
                      ? "Ready to use"
                      : "Ready when you are"}
                </span>
                <div className="copy-controls">
                  <select
                    aria-label="Copy format"
                    value={copyFormat}
                    onChange={(e) =>
                      setCopyFormat(e.target.value as CopyFormat)
                    }
                  >
                    <option>Rich HTML</option>
                    <option>Plain text</option>
                    <option>Markdown</option>
                  </select>
                  <button
                    className="copy-button"
                    disabled={!result}
                    onClick={copy}
                  >
                    <Copy size={14} /> Copy all
                  </button>
                </div>
              </footer>
            </section>
          </div>
          {error && (
            <div className="error workspace-error" role="alert">
              {error}
            </div>
          )}
          <section className="trust-strip" aria-label="Privacy information">
            <div>
              <ShieldCheck size={17} />
              <span>
                <strong>Privacy comes standard.</strong> Your email goes only to
                the server you configure.
              </span>
            </div>
            <button
              className="text-button"
              onClick={() => setSettingsOpen(true)}
            >
              Configure Your AI Server <Settings size={14} />
            </button>
          </section>
          <section className="how-it-works">
            <div className="how-label">A SMALLER INBOX, IN THREE STEPS</div>
            <div className="how-steps">
              <div>
                <span className="how-icon">
                  <Inbox size={17} />
                </span>
                <span>
                  <strong>Drop in your email</strong>
                  <small>Copy, paste, and leave the noise behind.</small>
                </span>
              </div>
              <ArrowRight className="how-arrow" size={17} />
              <div>
                <span className="how-icon">
                  <Terminal size={17} />
                </span>
                <span>
                  <strong>Let local AI do the reading</strong>
                  <small>Your model. On your machine or network.</small>
                </span>
              </div>
              <ArrowRight className="how-arrow" size={17} />
              <div>
                <span className="how-icon">
                  <Check size={18} />
                </span>
                <span>
                  <strong>Get straight to the next step</strong>
                  <small>Copy the clarity. Get on with your day.</small>
                </span>
              </div>
            </div>
          </section>
          <footer className="page-footer">
            <span>Built for a quieter workflow.</span>
            <span>
              <LockKeyhole size={12} /> No account needed{" "}
              <span className="stat-dot">·</span> OpenAI-compatible{" "}
              <ArrowDown size={12} />
            </span>
          </footer>
        </main>
      </div>
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(next, tested) => {
            // A result in flight belongs to the old connection; ignore it after saving.
            abort.current?.abort();
            setBusy(false);
            setResult(null);
            setError("");
            setSettings(next);
            setConnected(tested);
            setSettingsOpen(false);
            setNotice("Connection settings saved");
          }}
        />
      )}
      <div className={`toast ${notice ? "visible" : ""}`} role="status">
        {notice && (
          <>
            <Check size={16} />
            {notice}
          </>
        )}
      </div>
    </div>
  );
}
export default App;
