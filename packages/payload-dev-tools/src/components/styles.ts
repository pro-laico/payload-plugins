/** The toolbar's entire stylesheet, injected by `<DevToolbar>` as one `<style>` tag so the host
 *  app needs no CSS import and no Tailwind. Everything is `.pdt-` prefixed and self-contained
 *  (own dark theme); `--pdt-accent` is the override seam. */
export const PDT_CSS = `
.pdt-root { position: fixed; z-index: 999999; color-scheme: dark;
  --pdt-accent: oklch(0.72 0.16 250); --pdt-bg: oklch(0.185 0 0); --pdt-fg: oklch(0.985 0 0);
  --pdt-muted: oklch(0.708 0 0); --pdt-border: oklch(1 0 0 / 12%); --pdt-hover: oklch(1 0 0 / 7%);
  --pdt-danger: oklch(0.65 0.18 25); --pdt-warn: oklch(0.8 0.14 85);
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 1.45; color: var(--pdt-fg); }
.pdt-root *, .pdt-root *::before, .pdt-root *::after { box-sizing: border-box; }
/* :where() keeps this reset at zero specificity so component classes below always win it. */
:where(.pdt-root) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.pdt-root a { color: inherit; text-decoration: none; }

.pdt-corner-br { bottom: 16px; right: 16px; } .pdt-corner-bl { bottom: 16px; left: 16px; }
.pdt-corner-tr { top: 16px; right: 16px; } .pdt-corner-tl { top: 16px; left: 16px; }

/* The launcher: solid black, no shadow, a thin border that breathes toward grey — the same
   idiom as Next.js's own dev indicator, so the two read as siblings. */
@keyframes pdt-fab-breathe { 0%, 100% { border-color: oklch(0.25 0 0); } 50% { border-color: oklch(0.52 0 0); } }
.pdt-fab { display: flex; align-items: center; justify-content: center; border-radius: 999px;
  background: oklch(0 0 0); color: oklch(0.985 0 0); border: 1px solid oklch(0.25 0 0);
  animation: pdt-fab-breathe 4s ease-in-out infinite; transition: border-color 0.2s ease; }
.pdt-fab:hover { animation: none; border-color: oklch(0.6 0 0); }
.pdt-fab.pdt-open { animation: none; border-color: var(--pdt-accent); }
.pdt-fab-sm { width: 30px; height: 30px; } .pdt-fab-sm svg { width: 14px; height: 14px; }
.pdt-fab-md { width: 38px; height: 38px; } .pdt-fab-md svg { width: 17px; height: 17px; }
.pdt-fab-lg { width: 46px; height: 46px; } .pdt-fab-lg svg { width: 21px; height: 21px; }

.pdt-panel { position: absolute; width: 330px; max-height: 72vh; display: flex; flex-direction: column;
  overflow: hidden; border-radius: 12px; border: 1px solid var(--pdt-border); background: var(--pdt-bg);
  box-shadow: 0 12px 40px oklch(0 0 0 / 55%); }
.pdt-panel-br { bottom: calc(100% + 10px); right: 0; } .pdt-panel-bl { bottom: calc(100% + 10px); left: 0; }
.pdt-panel-tr { top: calc(100% + 10px); right: 0; } .pdt-panel-tl { top: calc(100% + 10px); left: 0; }

.pdt-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px;
  border-bottom: 1px solid var(--pdt-border); background: oklch(0.14 0 0); }
.pdt-head-title { flex: 1; font-family: ui-monospace, Consolas, monospace; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.08em; }
.pdt-head-badge { font-family: ui-monospace, Consolas, monospace; font-size: 10px; text-transform: uppercase;
  color: var(--pdt-muted); border: 1px solid var(--pdt-border); border-radius: 4px; padding: 1px 6px; }
.pdt-back { color: var(--pdt-muted); padding: 0 4px; font-size: 16px; line-height: 1; }
.pdt-back:hover { color: var(--pdt-fg); }

/* Minimal scrollbar for the tiny panel: a bare 4px thumb, no track, no arrows. */
.pdt-body { overflow-y: auto; padding: 8px; scrollbar-width: thin; scrollbar-color: oklch(0.42 0 0) transparent; }
.pdt-body::-webkit-scrollbar { width: 4px; }
.pdt-body::-webkit-scrollbar-track { background: transparent; }
.pdt-body::-webkit-scrollbar-thumb { background: oklch(0.42 0 0); border-radius: 999px; }
.pdt-body::-webkit-scrollbar-thumb:hover { background: oklch(0.58 0 0); }
.pdt-body::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.pdt-menu { list-style: none; margin: 0; padding: 0; }
.pdt-menu-row { display: flex; width: 100%; align-items: center; justify-content: space-between;
  padding: 9px 10px; border-radius: 8px; text-align: left; }
.pdt-menu-row:hover { background: var(--pdt-hover); }
.pdt-menu-hint { display: flex; align-items: center; gap: 8px; color: var(--pdt-muted);
  font-family: ui-monospace, Consolas, monospace; font-size: 11px; }

.pdt-card { border: 1px solid var(--pdt-border); border-radius: 10px; padding: 10px; margin: 4px 2px 10px; }
.pdt-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.pdt-card-title { font-weight: 600; }
.pdt-kind { font-family: ui-monospace, Consolas, monospace; font-size: 10px; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--pdt-muted); }
.pdt-viewing { color: var(--pdt-accent); font-weight: 600; }

.pdt-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pdt-chip { border: 1px solid var(--pdt-border); border-radius: 999px; padding: 5px 14px; font-size: 12.5px;
  background: oklch(0.24 0 0); transition: border-color 0.15s ease, background 0.15s ease; }
.pdt-chip:hover { background: oklch(0.29 0 0); border-color: oklch(0.45 0 0); }
.pdt-chip.pdt-active { background: var(--pdt-accent); border-color: var(--pdt-accent); color: oklch(0.13 0 0); font-weight: 600; }

.pdt-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--pdt-border);
  border-radius: 8px; padding: 7px 12px; font-size: 13px; font-weight: 500; }
.pdt-btn:hover { background: var(--pdt-hover); }
.pdt-btn:disabled { opacity: 0.55; cursor: default; }
.pdt-btn-danger { border-color: color-mix(in oklch, var(--pdt-danger), transparent 45%); color: var(--pdt-danger); }
.pdt-btn-primary { background: var(--pdt-accent); border-color: var(--pdt-accent); color: oklch(0.13 0 0); font-weight: 600; }

.pdt-muted { color: var(--pdt-muted); } .pdt-warn { color: var(--pdt-warn); } .pdt-danger-text { color: var(--pdt-danger); }
.pdt-small { font-size: 12px; } .pdt-mono { font-family: ui-monospace, Consolas, monospace; font-size: 0.9em; }
.pdt-note { margin: 6px 2px 4px; font-size: 11.5px; color: var(--pdt-muted); }
.pdt-code { font-family: ui-monospace, Consolas, monospace; font-size: 0.85em; background: oklch(0.26 0 0);
  padding: 1px 5px; border-radius: 4px; }
.pdt-error { margin-top: 8px; border: 1px solid color-mix(in oklch, var(--pdt-danger), transparent 55%);
  border-radius: 8px; padding: 8px 10px; font-size: 12.5px; color: var(--pdt-danger); }
.pdt-error ul { margin: 6px 0 0; padding-left: 18px; color: var(--pdt-fg); }

.pdt-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.pdt-table td { padding: 4px 8px; border-bottom: 1px solid var(--pdt-border); }
.pdt-table td:last-child { text-align: right; color: var(--pdt-muted); font-family: ui-monospace, Consolas, monospace; }
.pdt-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; }
.pdt-dot-on { background: oklch(0.75 0.15 165); } .pdt-dot-off { background: oklch(0.45 0 0); }

.pdt-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 4px; }
.pdt-corner-grid { display: grid; grid-template-columns: repeat(2, 24px); gap: 3px; }
.pdt-corner-btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--pdt-border); border-radius: 5px; font-size: 12px; }
.pdt-corner-btn:hover { background: var(--pdt-hover); }
.pdt-corner-btn.pdt-active { background: var(--pdt-accent); border-color: var(--pdt-accent); color: oklch(0.13 0 0); }
.pdt-seg { display: flex; overflow: hidden; border: 1px solid var(--pdt-border); border-radius: 6px; }
.pdt-seg button { padding: 4px 10px; font-size: 11px; text-transform: uppercase; }
.pdt-seg button:hover { background: var(--pdt-hover); }
.pdt-seg button.pdt-active { background: var(--pdt-accent); color: oklch(0.13 0 0); font-weight: 600; }

.pdt-menu-row.pdt-current { background: var(--pdt-hover); }
.pdt-menu-row.pdt-current > span:first-child { color: var(--pdt-accent); font-weight: 600; }

@media print { .pdt-root { display: none !important; } }
`
