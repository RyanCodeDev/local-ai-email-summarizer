import { createElement, Fragment } from "react";
import { Lexer } from "marked";
import type { Token, Tokens } from "marked";

/**
 * Parse Markdown, then render a fixed set of React elements. Model text never
 * enters innerHTML, tag names, attributes, or URLs. React escapes all text.
 * HTML tokens are dropped; links and images become text to prevent tracking.
 * The clipboard uses this exact renderer, too.
 */
function renderTokens(tokens: Token[]): React.ReactNode[] {
  return tokens.map((token, key) => {
    const children = () =>
      renderTokens(("tokens" in token && token.tokens) || []);
    switch (token.type) {
      case "space":
      case "def":
      case "html":
        return null;
      case "heading":
        return createElement(
          `h${Math.min(6, Math.max(1, (token as Tokens.Heading).depth))}`,
          { key },
          children(),
        );
      case "paragraph":
        return <p key={key}>{children()}</p>;
      case "text":
        return (
          <Fragment key={key}>
            {token.tokens ? children() : token.text}
          </Fragment>
        );
      case "escape":
        return <Fragment key={key}>{token.text}</Fragment>;
      case "strong":
        return <strong key={key}>{children()}</strong>;
      case "em":
        return <em key={key}>{children()}</em>;
      case "del":
        return <del key={key}>{children()}</del>;
      case "codespan":
        return <code key={key}>{token.text}</code>;
      case "code":
        return (
          <pre key={key}>
            <code>{token.text}</code>
          </pre>
        );
      case "blockquote":
        return <blockquote key={key}>{children()}</blockquote>;
      case "br":
        return <br key={key} />;
      case "hr":
        return <hr key={key} />;
      case "link":
        return <span key={key}>{children()}</span>;
      case "image":
        return (
          <span key={key}>
            {token.text ? `[Image: ${token.text}]` : "[Image omitted]"}
          </span>
        );
      case "list": {
        const list = token as Tokens.List;
        const items = list.items.map((item, index) => (
          <li key={index}>
            {item.task ? (item.checked ? "☑ " : "☐ ") : ""}
            {renderTokens(item.tokens)}
          </li>
        ));
        return list.ordered ? (
          <ol key={key} start={Number(list.start) || 1}>
            {items}
          </ol>
        ) : (
          <ul key={key}>{items}</ul>
        );
      }
      case "table": {
        const table = token as Tokens.Table;
        return (
          <table key={key}>
            <thead>
              <tr>
                {table.header.map((cell, index) => (
                  <th key={index}>{renderTokens(cell.tokens)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, column) => (
                    <td key={column}>{renderTokens(cell.tokens)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      default:
        return null;
    }
  });
}
export function Markdown({ children }: { children: string }) {
  return <>{renderTokens(Lexer.lex(children, { gfm: true }))}</>;
}
