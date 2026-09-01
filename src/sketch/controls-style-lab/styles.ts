/**
 * Indicator styles for the Controls Style Lab — CSS is the source of truth.
 *
 * Each style is one `css(scope)` function producing the rules that restyle a set
 * of `.sketch-controls` radios/checkboxes. The same function drives both the
 * in-lab preview (scoped to that style's demo group) and "Apply globally"
 * (scoped to the whole document), so there is a single definition with nothing
 * to keep in sync.
 *
 * Animation comes entirely from CSS `transition` on the `::before`/`::after`
 * indicators. The only thing CSS can't express is the radio "off-preview"
 * (a.k.a. threatened): when an unselected radio is hovered, the currently
 * selected sibling should partially deactivate. That needs a sibling-hover
 * class broadcast in JS (see attachRadioHoverBroadcast in sketch.ts); the CSS
 * here styles the resulting `.radio-group-hover` state.
 */

/** A matching set: one visual language for radios and checkboxes. */
export interface Style {
  name: string;
  /**
   * Produce the style's CSS. `scope` is a selector prefix that limits the rules
   * the `.sketch-controls` element itself, e.g. `[data-style="edge-bar"]` for
   * the preview, or `` (empty) to apply document-wide.
   */
  css: (scope: string) => string;
}

// --- selector + transition helpers ---------------------------------------

// Duration is driven by the --style-lab-transition variable (set from the
// controls); falls back to 180ms when applied globally outside the lab.
const TRANSITION = "transition: all var(--style-lab-transition, 180ms) ease;";

/** Build the four indicator selectors for a given scope. */
function sel(scope: string) {
  // `scope` qualifies the .sketch-controls element itself (same node), e.g.
  // `[data-style="edge-bar"]` for the preview or "" to apply document-wide.
  // It must NOT be a descendant combinator: the demo column *is* .sketch-controls.
  const radio = `.sketch-controls${scope} label:has(input[type="radio"])`;
  const check = `.sketch-controls${scope} label:has(input[type="checkbox"])`;
  // The :checked selectors must repeat the typed input so they match the
  // production rules' specificity exactly (production uses
  // `:has(input[type="radio"]:checked)`); otherwise the stock `height: 100%`
  // checked rule outweighs ours and the indicator fills the whole button.
  return {
    radio,
    check,
    radioBefore: `${radio}::before`,
    radioAfter: `${radio}::after`,
    radioHover: `${radio}:hover::before`,
    radioChecked: `${radio}:has(input[type="radio"]:checked)::before`,
    // Off-preview: a selected radio whose sibling is being hovered.
    radioThreatened: `${radio}.radio-group-hover:has(input[type="radio"]:checked)::before`,
    checkBefore: `${check}::before`,
    checkHover: `${check}:hover::before`,
    checkChecked: `${check}:has(input[type="checkbox"]:checked)::before`,
  };
}

/**
 * Full baseline for every indicator pseudo-element, emitted at the top of each
 * style. This clears anything the production CSS (or a previously-applied style)
 * set on ::before/::after that the new style doesn't re-specify — without this,
 * switching styles leaves orphaned bars/checkmarks behind. Each style then adds
 * its own rules *after* this block, so they win on the properties they set while
 * the reset covers the rest.
 */
function reset(s: ReturnType<typeof sel>): string {
  const NEUTRAL = `{
  content: none;
  position: absolute; left: 0; top: auto; bottom: auto; right: auto;
  width: 0; height: 0;
  margin: 0; padding: 0;
  background: transparent; border: none; border-radius: 0;
  box-shadow: none; filter: none; opacity: 1;
  transform: none;
  ${TRANSITION}
}`;
  return [
    `${s.radioBefore} ${NEUTRAL}`,
    `${s.radioAfter} ${NEUTRAL}`,
    `${s.checkBefore} ${NEUTRAL}`,
    `${s.check}::after ${NEUTRAL}`,
  ].join("\n");
}

// === EDGE BAR =============================================================
// Left-edge bar. Radio = hollow outline -> fills solid. Checkbox = solid notch
// that grows from a short centred bar to full height (different fill behaviour).

const edgeBar: Style["css"] = (scope) => {
  const s = sel(scope);
  return `
${reset(s)}
${s.radioBefore} {
  content: ""; position: absolute; left: 0; top: 50%;
  transform: translateY(-50%);
  width: 4px; height: 40%;
  border-radius: 0 2px 2px 0;
  background: transparent;
  border: 1.5px solid var(--accent-6); border-left: none;
  ${TRANSITION}
}
${s.radioHover} { border-color: var(--accent-8); height: 50%; }
${s.radioChecked} {
  height: 100%; background: var(--accent-a);
  border-color: transparent; box-shadow: 0 0 8px var(--accent-6);
}
${s.radioThreatened} { height: 55%; opacity: 0.7; box-shadow: none; }

${s.checkBefore} {
  content: ""; position: absolute; left: 0; top: 50%;
  transform: translateY(-50%);
  width: 4px; height: 28%;
  border-radius: 0 2px 2px 0;
  background: var(--accent-6);
  ${TRANSITION}
}
${s.checkHover} { background: var(--accent-8); height: 45%; }
${s.checkChecked} {
  height: 100%; background: var(--accent-a); box-shadow: 0 0 8px var(--accent-6);
}`;
};

// === SLIDING MARKER =======================================================
// A short tick marker. Radio = slides inward (translateX) as it activates.
// Checkbox = fixed position, grows in place. Both are the same tick shape.

const slidingMarker: Style["css"] = (scope) => {
  const s = sel(scope);
  return `
${reset(s)}
${s.radioBefore} {
  content: ""; position: absolute; left: 4px; top: 50%;
  transform: translate(-5px, -50%);
  width: 4px; height: 30%;
  border-radius: 2px;
  background: var(--accent-grey-7);
  ${TRANSITION}
}
${s.radioHover} { background: var(--accent-8); transform: translate(-2px, -50%); height: 38%; }
${s.radioChecked} {
  transform: translate(0, -50%);
  height: 55%; background: var(--accent-a); box-shadow: 0 0 8px var(--accent-6);
}
${s.radioThreatened} { transform: translate(-3px, -50%); height: 40%; opacity: 0.7; box-shadow: none; }

${s.checkBefore} {
  content: ""; position: absolute; left: 8px; top: 50%;
  transform: translateY(-50%);
  width: 4px; height: 30%;
  border-radius: 2px;
  background: var(--accent-grey-7);
  ${TRANSITION}
}
${s.checkHover} { background: var(--accent-8); }
${s.checkChecked} {
  height: 55%; background: var(--accent-a); box-shadow: 0 0 8px var(--accent-6);
}`;
};

// === UNDERLINE TRACK ======================================================
// A bar under the label. Radio = underline sweeps in from the left (width).
// Checkbox = full-width underline always present, hollow -> solid.

const underline: Style["css"] = (scope) => {
  const s = sel(scope);
  return `
${reset(s)}
${s.radioBefore} {
  content: ""; position: absolute; left: 10px; bottom: 4px; top: auto;
  transform: none;
  width: 0; height: 2.5px;
  border-radius: 1px;
  background: var(--accent-a);
  ${TRANSITION}
}
${s.radioHover} { background: var(--accent-8); width: 20px; }
${s.radioChecked} { width: calc(100% - 20px); box-shadow: 0 0 8px var(--accent-6); }
${s.radioThreatened} { width: 30%; opacity: 0.7; box-shadow: none; }

${s.checkBefore} {
  content: ""; position: absolute; left: 10px; bottom: 4px; top: auto;
  transform: none;
  width: calc(100% - 20px); height: 2px;
  border-radius: 1px;
  background: var(--accent-grey-3);
  ${TRANSITION}
}
${s.checkHover} { background: var(--accent-8); }
${s.checkChecked} { height: 3.5px; background: var(--accent-a); box-shadow: 0 0 8px var(--accent-6); }`;
};

// === CARET ================================================================
// A triangular caret built from CSS borders. Radio = points right (▸) and
// slides in. Checkbox = points down (▾). Same primitive, different orientation.

const caret: Style["css"] = (scope) => {
  const s = sel(scope);
  return `
${reset(s)}
${s.radioBefore} {
  content: ""; position: absolute; left: 6px; top: 50%;
  transform: translate(-3px, -50%);
  width: 0; height: 0;
  background: transparent; border-radius: 0;
  border: 5px solid transparent;
  border-left-color: var(--accent-grey-7);
  ${TRANSITION}
}
${s.radioHover} { border-left-color: var(--accent-8); transform: translate(-1.5px, -50%); }
${s.radioChecked} {
  transform: translate(0, -50%);
  border-left-color: var(--accent-a);
  filter: drop-shadow(0 0 4px var(--accent-6));
}
${s.radioThreatened} { transform: translate(-2px, -50%); opacity: 0.7; filter: none; }

${s.checkBefore} {
  content: ""; position: absolute; left: 6px; top: 50%;
  transform: translateY(-65%);
  width: 0; height: 0;
  background: transparent; border-radius: 0;
  border: 5px solid transparent;
  border-top-color: var(--accent-grey-7);
  ${TRANSITION}
}
${s.checkHover} { border-top-color: var(--accent-8); }
${s.checkChecked} {
  border-top-color: var(--accent-a);
  filter: drop-shadow(0 0 4px var(--accent-6));
}`;
};

// === CANONICAL ============================================================
// The conventional styles being avoided, for comparison: hollow circle -> dot
// radio, and a square box that draws a checkmark.

const canonical: Style["css"] = (scope) => {
  const s = sel(scope);
  return `
${reset(s)}
${s.radioBefore} {
  content: ""; position: absolute; left: 8px; top: 50%;
  transform: translateY(-50%);
  width: 13px; height: 13px;
  border-radius: 50%;
  background: transparent;
  border: 1.5px solid var(--accent-grey-5);
  box-shadow: none;
  ${TRANSITION}
}
${s.radioHover} { border-color: var(--accent-8); box-shadow: inset 0 0 0 1.5px var(--accent-8); }
${s.radioChecked} {
  border-color: var(--accent-6);
  box-shadow: inset 0 0 0 3px var(--accent-a);
}
${s.radioThreatened} { box-shadow: inset 0 0 0 1.5px var(--accent-a); opacity: 0.7; }

${s.checkBefore} {
  content: ""; position: absolute; left: 8px; top: 50%;
  transform: translateY(-50%) rotate(0deg);
  width: 13px; height: 13px;
  border-radius: 3px;
  background: transparent;
  border: 1.5px solid var(--accent-grey-5);
  ${TRANSITION}
}
${s.checkHover} { border-color: var(--accent-8); }
${s.checkChecked} {
  /* Box fills; the checkmark is drawn by ::after below. */
  background: var(--accent-4); border-color: var(--accent-6);
}
/* Checkmark via ::after for the checkbox only. */
${s.check}::after {
  content: ""; position: absolute; left: 12px; top: 50%;
  width: 4px; height: 8px;
  border: solid var(--accent-a); border-width: 0 2px 2px 0;
  transform: translateY(-65%) rotate(45deg) scale(0);
  transform-origin: center;
  ${TRANSITION}
}
${s.check}:has(input[type="checkbox"]:checked)::after {
  transform: translateY(-65%) rotate(45deg) scale(1);
}`;
};

/** Every style set shown in the lab, in display order. */
export interface StyleEntry extends Style {
  /** kebab-case id used as the demo scope and CSS comment. */
  id: string;
}

export const STYLES: StyleEntry[] = [
  { id: "canonical", name: "Canonical", css: canonical },
  { id: "edge-bar", name: "Edge bar", css: edgeBar },
  { id: "sliding-marker", name: "Sliding marker", css: slidingMarker },
  { id: "underline", name: "Underline track", css: underline },
  { id: "caret", name: "Caret", css: caret },
];

// === injection ============================================================

const CHROME_EL_ID = "controls-style-lab-chrome";
const PREVIEW_EL_ID = "controls-style-lab-previews";
const APPLIED_EL_ID = "controls-style-lab-applied";

/** Layout/chrome for the lab itself (not part of any style). */
const CHROME_CSS = `
.style-lab {
  /* Fill the canvas viewport regardless of its flex centring. */
  position: absolute; inset: 0;
  overflow-y: auto; padding: 20px;
  color: var(--accent-grey-e);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.style-lab__intro {
  font-size: 12px; color: var(--accent-grey-7);
  max-width: 60ch; margin-bottom: 20px; line-height: 1.5;
}
.style-lab__grid {
  display: grid; gap: 28px;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  align-items: start;
}
.style-lab__col { display: flex; flex-direction: column; gap: 8px; }
.style-lab__heading {
  font-size: 13px; font-weight: 700; color: var(--accent-grey-e);
  margin-bottom: 2px;
}
.style-lab__group { display: flex; flex-direction: column; gap: 7px; }
.style-lab__sublabel {
  font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
  color: var(--accent-grey-7); margin-top: 4px;
}
.style-lab__apply {
  margin-top: 6px; padding: 8px 10px;
  font-size: 11px; font-weight: 700; font-family: inherit;
  color: var(--accent-grey-e);
  background: var(--accent-grey-2);
  border: 1px solid var(--accent-grey-3); border-radius: 6px;
  cursor: pointer; transition: all 0.15s ease;
}
.style-lab__apply:hover { background: var(--accent-grey-3); border-color: var(--accent-grey-5); }
.style-lab__apply.is-applied {
  background: var(--accent-4); border-color: var(--accent-6); color: var(--accent-c);
}`;

function setStyleEl(id: string, css: string | undefined): void {
  const existing = document.getElementById(id);
  if (!css) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement("style");
  el.id = id;
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
}

/** Inject lab chrome + per-style preview CSS (each scoped to its group). */
export function injectPreviewCss(): void {
  setStyleEl(CHROME_EL_ID, CHROME_CSS);
  const css = STYLES.map((s) => `/* ${s.name} */\n${s.css(`[data-style="${s.id}"]`)}`).join("\n");
  setStyleEl(PREVIEW_EL_ID, css);
}

/**
 * Apply a style document-wide (or clear with `undefined`).
 *
 * Scoped to `.sketch-controls:not([data-style])` so it hits the *real* app
 * controls but NOT the lab's own demo columns (which carry `data-style` and
 * keep their own preview). Without this exclusion the unscoped global rules
 * leak into the demo columns and distort them, since a column's scoped preview
 * only overrides the properties it explicitly sets.
 */
export function applyStyleCss(style: StyleEntry | undefined): void {
  const css = style
    ? `/* Applied: ${style.name} */\n${style.css(":not([data-style])")}`
    : undefined;
  setStyleEl(APPLIED_EL_ID, css);
}

/** Remove the chrome + preview stylesheets (lab teardown). */
export function removePreviewCss(): void {
  setStyleEl(CHROME_EL_ID, undefined);
  setStyleEl(PREVIEW_EL_ID, undefined);
}
