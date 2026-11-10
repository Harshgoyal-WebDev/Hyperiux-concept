// Built using Hyperiux Vault: https://vault.hyperiux.com

import type { Block } from "./posts";

// Renders article blocks as plain HTML inside .ord-prose (styled in blog.css).
// Used by the blog posts and the privacy policy.
export default function Prose({ blocks, dark = false, className = "" }: { blocks: Block[]; dark?: boolean; className?: string }) {
  return (
    <div className={`ord-prose ${dark ? "ord-prose-dark" : ""} ${className}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "lead":
            return (
              <p key={i} className="prose-lead">
                {b.text}
              </p>
            );
          case "p":
            return <p key={i}>{b.text}</p>;
          case "h2":
            return (
              <h2 key={i} id={b.id} data-prose-heading>
                {b.text}
              </h2>
            );
          case "h3":
            return <h3 key={i}>{b.text}</h3>;
          case "list": {
            const List = b.ordered ? "ol" : "ul";
            return (
              <List key={i}>
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote key={i}>
                <p>{b.text}</p>
                {b.cite && <cite>{b.cite}</cite>}
              </blockquote>
            );
          case "callout":
            return (
              <aside key={i} className="prose-callout">
                <span className="prose-callout-title">{b.title}</span>
                <p>{b.text}</p>
              </aside>
            );
          case "code":
            return (
              <figure key={i} className="prose-code">
                <figcaption className="prose-code-bar">
                  <span>{b.lang}</span>
                  <span aria-hidden>Ordin SDK</span>
                </figcaption>
                <pre>
                  <code>{b.code}</code>
                </pre>
              </figure>
            );
          case "stats":
            return (
              <div key={i} className="prose-stats">
                {b.items.map((s) => (
                  <div key={s.label}>
                    <span className="prose-stat-value">{s.value}</span>
                    <span className="prose-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
