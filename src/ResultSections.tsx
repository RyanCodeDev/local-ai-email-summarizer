import { Copy } from "lucide-react";
import { Markdown } from "./Markdown";
import type { EmailResult } from "./lib/results";

interface Props {
  result: EmailResult;
  onCopyReply?: (body: string, index: number) => void;
}

/** Shared display/export structure. Reply bodies are literal text so their
 * paragraph breaks and clipboard content stay independent of Markdown parsing.
 * Omitting the callback excludes interactive controls from exported HTML.
 */
export function ResultSections({ result, onCopyReply }: Props) {
  return (
    <div className="structured-results">
      <section className="result-section" aria-label="Summary">
        <h2>Summary</h2>
        <Markdown>{result.summary}</Markdown>
      </section>
      <section className="result-section" aria-label="Action items">
        <h2>Action items</h2>
        {result.action_items.length ? (
          <ul>
            {result.action_items.map((item, index) => (
              <li key={index}>
                <Markdown>{item}</Markdown>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-actions">No action items identified.</p>
        )}
      </section>
      <section
        className="result-section replies-section"
        aria-label="Suggested replies"
      >
        <h2>Suggested replies</h2>
        {onCopyReply && (
          <p className="reply-help">
            Choose a draft. Each copy button copies only that reply as plain
            text.
          </p>
        )}
        {result.replies.map((reply, index) => (
          <article
            className="reply-card"
            key={index}
            aria-label={`Reply ${index + 1}: ${reply.title}`}
          >
            <header className="reply-header">
              <h3>
                <span className="reply-number">{index + 1}</span> {reply.title}
              </h3>
              {onCopyReply && (
                <button
                  className="copy-button reply-copy"
                  type="button"
                  aria-label={`Copy reply ${index + 1} as plain text`}
                  onClick={() => onCopyReply(reply.body, index)}
                >
                  <Copy size={13} /> Copy reply
                </button>
              )}
            </header>
            <p className="reply-body" style={{ whiteSpace: "pre-wrap" }}>
              {reply.body}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
