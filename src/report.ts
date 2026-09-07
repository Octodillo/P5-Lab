/**
 * Front-end error reporting.
 *
 * Two audiences, one pipeline. Whoever is *using* the lab sees a plain
 * sentence about what happened and what they can do next; whoever is
 * *writing* a sketch gets the stack, the source location and the cause
 * chain, one disclosure click away — and always in the console.
 *
 * Severity decides the shape:
 * - `warning` / `error` → a toast in the corner. The sketch keeps running.
 * - `fatal`             → a panel over the sketch viewport. Nothing is
 *                         running any more, so say so and offer a way back.
 */

export type Severity = "warning" | "error" | "fatal";

export interface ReportAction {
  readonly label: string;
  readonly run: () => void;
  /** Renders as the filled, primary-looking button. At most one per report. */
  readonly primary?: boolean;
}

export interface ReportInit {
  /** One plain sentence for the person watching. No jargon, no blame. */
  readonly hint?: string;
  /** Developer detail. Falls back to the stack of `cause`. */
  readonly detail?: string;
  /** The thrown value, if there was one. Its stack and `cause` chain are read. */
  readonly cause?: unknown;
  /** Where it came from: `"boids/sketch.ts"`, `"update()"`, `"control: speed"`. */
  readonly source?: string;
  /** Offered as buttons. Fatals always get a "Reload sketch" action for free. */
  readonly actions?: readonly ReportAction[];
  /** Auto-dismiss delay in ms. `0` pins the toast until dismissed. */
  readonly timeout?: number;
}

export interface Report extends ReportInit {
  readonly severity: Severity;
  readonly title: string;
  readonly at: Date;
}

const DEFAULT_TIMEOUT: Record<Severity, number> = {
  // Long enough to read twice, short enough not to nag.
  warning: 7000,
  error: 14000,
  fatal: 0,
};

/** Beyond this, the oldest toast is retired to keep the corner readable. */
const MAX_TOASTS = 4;

/** Kept for `Lab.reports` — a session log you can page through in the console. */
const MAX_HISTORY = 50;

const ICONS: Record<Severity, string> = {
  warning:
    `<path d="M12 3.2 22 20H2L12 3.2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9.5v4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.05" fill="currentColor"/>`,
  error:
    `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.4v5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="16.3" r="1.05" fill="currentColor"/>`,
  fatal:
    `<path d="M8.6 3h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6L8.6 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m9.4 9.4 5.2 5.2M14.6 9.4l-5.2 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
};

// =============================================================================
// Formatting
// =============================================================================

/**
 * Turn transpiled-module URLs back into paths you can open.
 *
 * Sketches are imported as `http://host/_/sketch/x.ts?t=1699999999999`, which
 * is unreadable in a stack trace and different on every reload. Rewriting to
 * `src/sketch/x.ts` also makes repeated failures compare equal, so the toast
 * deduper can count them instead of stacking them.
 */
export const cleanStack = (text: string): string =>
  text
    .replaceAll(/https?:\/\/[^/\s)]+\/_\//g, "src/")
    .replaceAll(/https?:\/\/[^/\s)]+\//g, "/")
    .replaceAll(/\?t=\d+/g, "");

const stringify = (value: unknown): string => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

/** Message + stack + the whole `cause` chain, flattened and de-URL'd. */
export const describe = (cause: unknown, depth = 0): string => {
  if (cause === undefined || cause === null) return "";

  if (cause instanceof Error) {
    const head = cause.stack?.trim() || `${cause.name}: ${cause.message}`;
    const lines = cleanStack(head).split("\n");
    // A wall of frames helps nobody; the top of the stack is where the bug is.
    const trimmed = lines.length > 14 ? [...lines.slice(0, 14), "    …"] : lines;
    let out = trimmed.join("\n");

    if (depth < 4 && cause.cause !== undefined && cause.cause !== null) {
      out += `\n\nCaused by: ${describe(cause.cause, depth + 1)}`;
    }
    if (cause instanceof AggregateError && depth < 4) {
      for (const inner of cause.errors) out += `\n\nAlso: ${describe(inner, depth + 1)}`;
    }
    return out;
  }

  return cleanStack(stringify(cause));
};

/** The developer payload for a report, however it was supplied. */
export const detailOf = (report: Report): string => {
  const parts: string[] = [];
  if (report.detail) parts.push(report.detail);
  const fromCause = describe(report.cause);
  if (fromCause && fromCause !== report.detail) parts.push(fromCause);
  return parts.join("\n\n");
};

/** Everything a bug report needs, as plain text. */
export const transcribe = (report: Report): string =>
  [
    `[${report.severity}] ${report.title}`,
    report.hint,
    report.source && `source: ${report.source}`,
    `time: ${report.at.toISOString()}`,
    `sketch: ${location.pathname}`,
    "",
    detailOf(report) || "(no further detail)",
  ]
    .filter(Boolean)
    .join("\n");

// =============================================================================
// Reporter
// =============================================================================

/** A live toast: its element, its dismissal timer, and how many times it hit. */
interface Toast {
  readonly key: string;
  readonly el: HTMLElement;
  readonly countEl: HTMLElement;
  count: number;
  timer: number | undefined;
  remaining: number;
  startedAt: number;
  /** Pointer or focus is on the toast; the dismissal clock is paused. */
  held: boolean;
}

export interface ReporterOptions {
  /** Toasts are appended here. Defaults to `document.body`. */
  readonly toastMount?: HTMLElement;
  /** The fatal panel covers this element. Defaults to `document.body`. */
  readonly overlayMount?: HTMLElement;
  /** Invoked by the fatal panel's "Reload sketch" button. */
  readonly onReload?: () => void;
}

export class Reporter {
  private toastHost: HTMLElement | undefined;
  private overlay: HTMLElement | undefined;
  private readonly toasts = new Map<string, Toast>();

  /** Every report this session, newest last. Inspect via `Lab.reports`. */
  readonly history: Report[] = [];

  constructor(private readonly options: ReporterOptions = {}) {}

  warn(title: string, init: ReportInit = {}) {
    return this.push("warning", title, init);
  }

  error(title: string, init: ReportInit = {}) {
    return this.push("error", title, init);
  }

  fatal(title: string, init: ReportInit = {}) {
    return this.push("fatal", title, init);
  }

  /**
   * Run `fn`, reporting anything it throws as a non-fatal error instead of
   * letting it escape. Returns `undefined` on failure, so callers can branch.
   */
  guard<T>(title: string, init: ReportInit, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (cause) {
      this.error(title, { ...init, cause });
      return undefined;
    }
  }

  /** Clear the fatal panel — a new sketch is taking the stage. */
  clearFatal() {
    safely(() => {
      this.overlay?.remove();
      this.overlay = undefined;
    });
  }

  /** Clear every toast. */
  clearToasts() {
    safely(() => {
      for (const toast of [...this.toasts.values()]) this.dismiss(toast);
    });
  }

  clear() {
    this.clearFatal();
    this.clearToasts();
  }

  // --- internals -----------------------------------------------------------

  private push(severity: Severity, title: string, init: ReportInit): Report {
    const report: Report = { ...init, severity, title, at: new Date() };

    // The console mirror is unconditional: reporting must never be the reason
    // a developer can't find something, even if rendering below falls over.
    safely(() => mirrorToConsole(report));

    this.history.push(report);
    if (this.history.length > MAX_HISTORY) this.history.shift();

    // Nothing in here may throw. A reporter that fails while reporting turns a
    // legible bug into an invisible one.
    safely(() => {
      if (severity === "fatal") this.renderOverlay(report);
      else this.renderToast(report);
    });

    return report;
  }

  // --- toasts --------------------------------------------------------------

  private host(): HTMLElement {
    if (this.toastHost?.isConnected) return this.toastHost;
    const host = el("div", "report-toasts");
    host.setAttribute("role", "status");
    // Announce arrivals without stealing focus or interrupting a screen reader.
    host.setAttribute("aria-live", "polite");
    (this.options.toastMount ?? document.body).appendChild(host);
    return (this.toastHost = host);
  }

  private renderToast(report: Report) {
    const key = `${report.severity} ${report.title} ${report.source ?? ""} ${
      detailOf(report).split("\n")[0] ?? ""
    }`;

    // The same failure firing every frame should read as a count, not as two
    // hundred stacked toasts. Bump the tally and restart the clock instead.
    const existing = this.toasts.get(key);
    if (existing) {
      existing.count++;
      existing.countEl.textContent = `${existing.count}`;
      existing.countEl.hidden = false;
      existing.el.classList.remove("report-toast--pulse");
      // Reflow so the animation restarts rather than being a no-op.
      void existing.el.offsetWidth;
      existing.el.classList.add("report-toast--pulse");
      this.arm(existing, report.timeout ?? DEFAULT_TIMEOUT[report.severity]);
      return;
    }

    const toast: Toast = {
      key,
      el: el("div", `report-toast report-toast--${report.severity}`),
      countEl: el("span", "report-toast__count"),
      count: 1,
      timer: undefined,
      remaining: 0,
      startedAt: 0,
      held: false,
    };
    toast.countEl.hidden = true;
    toast.countEl.title = "Times this happened";

    const icon = svgIcon(report.severity, "report-toast__icon");
    const body = el("div", "report-toast__body");

    const titleRow = el("div", "report-toast__title");
    titleRow.append(text("span", report.title), toast.countEl);
    body.appendChild(titleRow);

    if (report.hint) body.appendChild(text("p", report.hint, "report-toast__hint"));
    if (report.source) body.appendChild(text("code", report.source, "report-toast__source"));

    const detail = detailOf(report);
    if (detail) body.appendChild(disclosure(detail, report));

    const actions = this.actionBar(report, "report-toast__actions");
    if (actions) body.appendChild(actions);

    const close = el("button", "report-toast__close") as HTMLButtonElement;
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML =
      `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    close.addEventListener("click", () => this.dismiss(toast));

    toast.el.append(icon, body, close);

    // Reading a stack trace takes longer than the timeout allows for, so hold
    // the clock while the pointer is over the toast and resume when it leaves.
    const grab = () => {
      toast.held = true;
      this.hold(toast);
    };
    const release = () => {
      toast.held = false;
      this.resume(toast);
    };
    toast.el.addEventListener("pointerenter", grab);
    toast.el.addEventListener("pointerleave", release);
    toast.el.addEventListener("focusin", grab);
    toast.el.addEventListener("focusout", release);

    this.host().appendChild(toast.el);
    this.toasts.set(key, toast);

    while (this.toasts.size > MAX_TOASTS) {
      const oldest = this.toasts.values().next().value;
      if (!oldest) break;
      this.dismiss(oldest);
    }

    requestAnimationFrame(() => toast.el.classList.add("report-toast--in"));
    this.arm(toast, report.timeout ?? DEFAULT_TIMEOUT[report.severity]);
  }

  private arm(toast: Toast, timeout: number) {
    this.hold(toast);
    toast.remaining = timeout;
    this.resume(toast);
  }

  private hold(toast: Toast) {
    if (toast.timer === undefined) return;
    clearTimeout(toast.timer);
    toast.timer = undefined;
    toast.remaining -= Date.now() - toast.startedAt;
  }

  private resume(toast: Toast) {
    // A repeat of a held toast refreshes its count and its budget, but must
    // not start the clock again while the reader still has it under the cursor.
    if (toast.held || toast.timer !== undefined || toast.remaining <= 0) return;
    toast.startedAt = Date.now();
    toast.timer = setTimeout(() => this.dismiss(toast), toast.remaining);
  }

  private dismiss(toast: Toast) {
    if (toast.timer !== undefined) clearTimeout(toast.timer);
    this.toasts.delete(toast.key);
    toast.el.classList.remove("report-toast--in");
    toast.el.classList.add("report-toast--out");
    toast.el.addEventListener("transitionend", () => toast.el.remove(), { once: true });
    // Belt and braces: if the transition never fires (reduced motion, hidden
    // tab), the node still goes away.
    setTimeout(() => toast.el.remove(), 400);
  }

  // --- fatal overlay -------------------------------------------------------

  private renderOverlay(report: Report) {
    this.clearFatal();

    const overlay = el("div", "report-overlay");
    overlay.setAttribute("role", "alert");

    const card = el("div", "report-overlay__card");
    card.append(svgIcon("fatal", "report-overlay__icon"));
    card.append(text("h2", report.title, "report-overlay__title"));

    if (report.hint) card.append(text("p", report.hint, "report-overlay__hint"));
    if (report.source) card.append(text("code", report.source, "report-overlay__source"));

    const actions = this.actionBar(report, "report-overlay__actions", true);
    if (actions) card.append(actions);

    const detail = detailOf(report);
    if (detail) card.append(disclosure(detail, report, "Technical details"));

    overlay.append(card);
    (this.options.overlayMount ?? document.body).appendChild(overlay);
    this.overlay = overlay;
  }

  /** Report actions, plus the affordances every fatal should carry. */
  private actionBar(report: Report, className: string, fatal = false): HTMLElement | undefined {
    const actions = [...(report.actions ?? [])];

    if (fatal) {
      const { onReload } = this.options;
      if (onReload && !actions.some((a) => a.primary)) {
        actions.unshift({ label: "Reload sketch", run: onReload, primary: true });
      }
      actions.push({ label: "Copy details", run: () => void copy(transcribe(report)) });
    }

    if (actions.length === 0) return undefined;

    const bar = el("div", className);
    for (const action of actions) {
      const button = el(
        "button",
        `report-action${action.primary ? " report-action--primary" : ""}`,
      ) as HTMLButtonElement;
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        // An action that throws must not take the error panel down with it.
        safely(action.run, (cause) =>
          mirrorToConsole({
            severity: "error",
            title: `Report action "${action.label}" failed`,
            cause,
            at: new Date(),
          }));
      });
      bar.appendChild(button);
    }
    return bar;
  }
}

// =============================================================================
// DOM helpers
// =============================================================================

const el = (tag: string, className?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

const text = (tag: string, content: string, className?: string): HTMLElement => {
  const node = el(tag, className);
  node.textContent = content;
  return node;
};

const svgIcon = (severity: Severity, className: string): SVGElement => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  svg.innerHTML = ICONS[severity];
  return svg;
};

/** Collapsed stack trace with a copy button — invisible until asked for. */
const disclosure = (detail: string, report: Report, label = "Details"): HTMLElement => {
  const details = el("details", "report-detail");
  const summary = text("summary", label, "report-detail__summary");
  const pre = text("pre", detail, "report-detail__body");

  const copyButton = el("button", "report-detail__copy") as HTMLButtonElement;
  copyButton.type = "button";
  copyButton.textContent = "Copy";
  copyButton.addEventListener("click", async () => {
    const ok = await copy(transcribe(report));
    copyButton.textContent = ok ? "Copied" : "Copy failed";
    setTimeout(() => (copyButton.textContent = "Copy"), 1500);
  });

  const shell = el("div", "report-detail__shell");
  shell.append(pre, copyButton);
  details.append(summary, shell);
  return details;
};

const copy = async (payload: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(payload);
    return true;
  } catch {
    return false;
  }
};

// =============================================================================
// Console mirror
// =============================================================================

const CONSOLE_STYLE: Record<Severity, string> = {
  warning: "color:#fbbf24",
  error: "color:#f87171",
  fatal: "color:#fff;background:#991b1b;padding:1px 5px;border-radius:3px",
};

const mirrorToConsole = (report: Report) => {
  const label = report.source ? `${report.title} — ${report.source}` : report.title;
  const write = report.severity === "warning" ? console.warn : console.error;
  const detail = detailOf(report);

  if (!detail && !report.hint) {
    write(`%c${report.severity}%c ${label}`, CONSOLE_STYLE[report.severity], "", report.cause);
    return;
  }

  console.groupCollapsed(`%c${report.severity}%c ${label}`, CONSOLE_STYLE[report.severity], "");
  if (report.hint) console.info(report.hint);
  if (detail) write(detail);
  if (report.cause !== undefined) console.debug(report.cause);
  console.groupEnd();
};

/** Run `fn`, swallowing failures. Used only where throwing would be worse. */
const safely = (fn: () => void, onError?: (cause: unknown) => void) => {
  try {
    fn();
  } catch (cause) {
    if (onError) {
      try {
        onError(cause);
        return;
      } catch { /* fall through to the console */ }
    }
    console.error("Error reporting itself failed.", cause);
  }
};
