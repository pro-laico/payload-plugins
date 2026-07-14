export const PDTP_CSS = `
.pdtp { color-scheme: dark;
  --pdtp-accent: oklch(0.72 0.16 250); --pdtp-bg: oklch(0.145 0 0); --pdtp-card: oklch(0.2 0 0);
  --pdtp-fg: oklch(0.985 0 0); --pdtp-muted: oklch(0.708 0 0); --pdtp-border: oklch(1 0 0 / 12%);
  --pdtp-hover: oklch(1 0 0 / 7%); --pdtp-danger: oklch(0.65 0.18 25); --pdtp-warn: oklch(0.8 0.14 85);
  background: var(--pdtp-bg); color: var(--pdtp-fg); min-height: 60vh;
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: 15px; line-height: 1.5; }
.pdtp *, .pdtp *::before, .pdtp *::after { box-sizing: border-box; }
.pdtp a { color: var(--pdtp-accent); text-decoration: none; }
.pdtp a:hover { text-decoration: underline; }
/* :where() keeps this reset at zero specificity so component classes below always win it. */
:where(.pdtp) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }

.pdtp-container { max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; }
.pdtp-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
.pdtp-head h1 { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; color: var(--pdtp-fg); }
.pdtp-badge { font-family: ui-monospace, Consolas, monospace; font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--pdtp-muted); border: 1px solid var(--pdtp-border); border-radius: 4px; padding: 2px 7px; }
.pdtp-env { color: var(--pdtp-muted); font-size: 0.85rem; }

.pdtp-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.pdtp-card { border: 1px solid var(--pdtp-border); background: var(--pdtp-card); border-radius: 12px; padding: 16px; }
.pdtp-card h2 { margin: 0 0 10px; font-size: 1rem; font-weight: 600; color: var(--pdtp-fg); display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.pdtp-kind { font-family: ui-monospace, Consolas, monospace; font-size: 10.5px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--pdtp-muted); font-weight: 400; }
.pdtp-section { margin: 32px 0 0; }
.pdtp-section > h2 { margin: 0 0 12px; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--pdtp-muted); font-weight: 600; }

.pdtp-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.pdtp-table td, .pdtp-table th { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--pdtp-border); }
.pdtp-table th { color: var(--pdtp-muted); font-weight: 500; font-size: 0.8rem; }
.pdtp-table td:last-child, .pdtp-table th:last-child { text-align: right; }
.pdtp-mono { font-family: ui-monospace, Consolas, monospace; font-size: 0.85em; }
.pdtp-code { font-family: ui-monospace, Consolas, monospace; font-size: 0.85em; background: oklch(0.26 0 0); padding: 1px 6px; border-radius: 4px; }
.pdtp-muted { color: var(--pdtp-muted); }
.pdtp-warn { color: var(--pdtp-warn); }

.pdtp-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px; }
.pdtp-dot-on { background: oklch(0.75 0.15 165); } .pdtp-dot-off { background: oklch(0.45 0 0); }
.pdtp-chips { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 0.9rem; }

.pdtp-chip { border: 1px solid var(--pdtp-border); border-radius: 999px; padding: 5px 14px; font-size: 0.85rem;
  background: oklch(0.26 0 0); transition: border-color 0.15s ease, background 0.15s ease; }
.pdtp-chip:hover { background: oklch(0.31 0 0); border-color: oklch(0.45 0 0); }
.pdtp-chip.pdtp-active { background: var(--pdtp-accent); border-color: var(--pdtp-accent); color: oklch(0.13 0 0); font-weight: 600; }
.pdtp-seg { display: inline-flex; overflow: hidden; border: 1px solid var(--pdtp-border); border-radius: 999px; }
.pdtp-seg button { padding: 4px 13px; font-size: 0.8rem; }
.pdtp-seg button:hover { background: var(--pdtp-hover); }
.pdtp-seg button.pdtp-active { background: var(--pdtp-accent); color: oklch(0.13 0 0); font-weight: 600; }

.pdtp-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--pdtp-border);
  border-radius: 8px; padding: 7px 14px; font-size: 0.9rem; font-weight: 500; }
.pdtp-btn:hover { background: var(--pdtp-hover); text-decoration: none; }
.pdtp-btn:disabled { opacity: 0.55; cursor: default; }
.pdtp-btn-primary { background: var(--pdtp-accent); border-color: var(--pdtp-accent); color: oklch(0.13 0 0); font-weight: 600; }
.pdtp-btn-danger { border-color: color-mix(in oklch, var(--pdtp-danger), transparent 45%); color: var(--pdtp-danger); }
.pdtp-error { margin-top: 10px; border: 1px solid color-mix(in oklch, var(--pdtp-danger), transparent 55%);
  border-radius: 8px; padding: 10px 12px; font-size: 0.85rem; color: var(--pdtp-danger); }
.pdtp-error ul { margin: 6px 0 0; padding-left: 18px; color: var(--pdtp-fg); }
.pdtp-note { color: var(--pdtp-muted); font-size: 0.82rem; margin: 10px 0 0; }

.pdtp-icon-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
.pdtp-icon-cell { display: flex; flex-direction: column; align-items: center; gap: 8px; border: 1px solid var(--pdtp-border);
  border-radius: 10px; padding: 14px 8px 10px; background: var(--pdtp-card); }
.pdtp-icon-cell svg { width: 28px; height: 28px; color: var(--pdtp-fg); }
.pdtp-icon-cell figcaption { font-family: ui-monospace, Consolas, monospace; font-size: 10.5px; color: var(--pdtp-muted);
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.pdtp-img-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.pdtp-img-cell { border: 1px solid var(--pdtp-border); border-radius: 10px; overflow: hidden; background: var(--pdtp-card); }
.pdtp-img-cell img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.pdtp-img-cell figcaption { padding: 7px 10px; font-family: ui-monospace, Consolas, monospace; font-size: 10.5px;
  color: var(--pdtp-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* /dev/revalidate — the dependency explorer */
.pdtp-flow { height: 440px; border: 1px solid var(--pdtp-border); border-radius: 12px; overflow: hidden; background: var(--pdtp-card); }
.pdtp-flow .react-flow { background: var(--pdtp-card); }
.pdtp-flow-node { display: flex; align-items: center; gap: 8px; border: 1px solid var(--pdtp-border); background: oklch(0.26 0 0);
  border-radius: 8px; padding: 8px 12px; font-size: 13px; cursor: pointer; transition: border-color 0.15s ease; }
.pdtp-flow-node:hover { border-color: oklch(0.5 0 0); }
.pdtp-flow-node-active { border-color: var(--pdtp-accent); box-shadow: 0 0 0 1px var(--pdtp-accent); }
.pdtp-flow-badges { display: inline-flex; gap: 6px; }
.pdtp-flow-badges em { font-style: normal; font-family: ui-monospace, Consolas, monospace; font-size: 10px; color: var(--pdtp-muted);
  border: 1px solid var(--pdtp-border); border-radius: 4px; padding: 1px 5px; white-space: nowrap; }
.pdtp-flow-badges em.pdtp-flow-warn { color: var(--pdtp-warn); border-color: color-mix(in oklch, var(--pdtp-warn), transparent 55%); }
.pdtp-flow-handle { opacity: 0; pointer-events: none; }
.pdtp-rev-cols { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.pdtp-rev-subhead { margin: 0 0 8px; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--pdtp-muted); font-weight: 600; }
.pdtp-rev-list { margin: 0; padding-left: 18px; font-size: 0.9rem; }
.pdtp-rev-list li { margin: 3px 0; }

.pdtp-specimen { border: 1px solid var(--pdtp-border); background: var(--pdtp-card); border-radius: 12px; padding: 20px; margin-bottom: 14px; }
.pdtp-specimen-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.pdtp-specimen-big { font-size: 2.2rem; line-height: 1.15; margin: 0 0 8px; overflow-wrap: break-word; }
.pdtp-specimen-body { margin: 0; color: var(--pdtp-muted); }
`
