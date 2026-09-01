import { checkbox, slider } from "../../controls.ts";
import { receive, Sketch } from "../../lab.ts";
import {
  applyStyleCss,
  injectPreviewCss,
  removePreviewCss,
  type StyleEntry,
  STYLES,
} from "./styles.ts";

/**
 * Controls Style Lab
 *
 * Renders *real* DOM radio/checkbox groups (the same markup the app's controls
 * use) and lets each style's CSS animate them — CSS is the source of truth, so
 * the in-lab preview and "Apply globally" share one definition (see styles.ts).
 *
 * The only behaviour CSS can't express is the radio "off-preview" / threatened
 * state: when an unselected radio is hovered, the selected sibling should
 * partially deactivate. We broadcast a `radio-group-hover` class to siblings on
 * hover (mirroring the app's own controls) so the CSS can target it.
 *
 * This sketch builds DOM rather than drawing to the canvas; update()/draw() are
 * intentional no-ops.
 */

const Controller = [
  checkbox("animate", "Animate transitions", true),
  slider("animSpeed", 40, 600, 180, 10, "Transition (ms)"),
] as const;

class ControlsStyleLab extends Sketch<typeof Controller> {
  readonly schema = Controller;

  private root?: HTMLElement;
  private applyButtons = new Map<string, HTMLButtonElement>();
  private appliedId?: string;

  override setup(): void {
    // This sketch is DOM-driven; drop the p5 canvas so only our markup shows.
    // (CSS marks `.sketch-viewport__canvas canvas` display:block !important, so
    // hiding it isn't enough — remove it outright.)
    (this.p5 as unknown as { canvas?: HTMLCanvasElement }).canvas?.remove();

    injectPreviewCss();
    this.buildDom();

    this.controls.subscribe("animate", () => this.syncAnimation());
    this.controls.subscribe("animSpeed", () => this.syncAnimation());
    this.syncAnimation();
  }

  /** Build the grid of real control groups, one column per style. */
  private buildDom(): void {
    const host = this.lab.containers.sketch;
    const root = document.createElement("div");
    root.className = "style-lab";
    this.root = root;

    const intro = document.createElement("p");
    intro.className = "style-lab__intro";
    intro.textContent =
      'Real radios & checkboxes styled by each style’s CSS. Hover an unselected radio to see the selected one preview-deactivate. "Apply globally" promotes that CSS to the whole app.';
    root.appendChild(intro);

    const grid = document.createElement("div");
    grid.className = "style-lab__grid";
    root.appendChild(grid);

    for (const style of STYLES) {
      grid.appendChild(this.buildColumn(style));
    }

    host.appendChild(root);
  }

  private buildColumn(style: StyleEntry): HTMLElement {
    const col = document.createElement("section");
    col.className = "style-lab__col sketch-controls";
    col.dataset.style = style.id;

    const heading = document.createElement("h3");
    heading.className = "style-lab__heading";
    heading.textContent = style.name;
    col.appendChild(heading);

    col.appendChild(this.buildRadioGroup(style.id, ["Alpha", "Beta", "Gamma"]));
    col.appendChild(this.buildCheckGroup(["Grid", "Snap"]));

    const apply = document.createElement("button");
    apply.className = "style-lab__apply";
    apply.type = "button";
    apply.textContent = "Apply globally";
    apply.addEventListener("click", () => this.toggleApply(style));
    this.applyButtons.set(style.id, apply);
    col.appendChild(apply);

    return col;
  }

  private buildRadioGroup(styleId: string, labels: string[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "style-lab__group";
    this.sublabel(wrap, "RADIO");

    const groupId = `style-lab-${styleId}`;
    labels.forEach((text, i) => {
      const label = document.createElement("label");
      label.dataset.radioGroup = groupId;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = groupId;
      input.checked = i === 0;
      label.append(input, this.span(text));
      this.attachRadioHoverBroadcast(label, groupId);
      wrap.appendChild(label);
    });
    return wrap;
  }

  private buildCheckGroup(labels: string[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "style-lab__group";
    this.sublabel(wrap, "CHECKBOX");

    for (const text of labels) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      label.append(input, this.span(text));
      wrap.appendChild(label);
    }
    return wrap;
  }

  /**
   * Mirror the app's sibling-hover behaviour: hovering one radio adds
   * `radio-group-hover` to the *other* labels in the group, which the CSS uses
   * to render the selected radio's off-preview (threatened) state.
   */
  private attachRadioHoverBroadcast(label: HTMLElement, groupId: string): void {
    const siblings = (root: HTMLElement) =>
      root.querySelectorAll<HTMLElement>(`label[data-radio-group="${groupId}"]`);
    label.addEventListener("mouseenter", () => {
      const root = this.root;
      if (!root) return;
      siblings(root).forEach((s) => {
        if (s !== label) s.classList.add("radio-group-hover");
      });
    });
    label.addEventListener("mouseleave", () => {
      const root = this.root;
      if (!root) return;
      siblings(root).forEach((s) => s.classList.remove("radio-group-hover"));
    });
  }

  private sublabel(parent: HTMLElement, text: string): void {
    const el = document.createElement("div");
    el.className = "style-lab__sublabel";
    el.textContent = text;
    parent.appendChild(el);
  }

  private span(text: string): HTMLSpanElement {
    const s = document.createElement("span");
    s.textContent = text;
    return s;
  }

  private toggleApply(style: StyleEntry): void {
    const clearing = this.appliedId === style.id;
    this.appliedId = clearing ? undefined : style.id;
    applyStyleCss(clearing ? undefined : style);
    for (const [id, btn] of this.applyButtons) {
      const active = id === this.appliedId;
      btn.classList.toggle("is-applied", active);
      btn.textContent = active ? "✓ Applied — click to clear" : "Apply globally";
    }
  }

  /** Drive transition timing from the controls via a CSS variable on the root. */
  private syncAnimation(): void {
    if (!this.root) return;
    const { animate, animSpeed } = this.controls.values;
    this.root.style.setProperty("--style-lab-transition", animate ? `${animSpeed}ms` : "0ms");
  }

  override remove(): void {
    removePreviewCss();
    // The applied style intentionally persists (so it can be seen elsewhere in
    // the app); reload or re-apply to reset.
    this.root?.remove();
    this.applyButtons.clear();
    super.remove();
  }

  // DOM-driven demo: no per-frame canvas work.
  update(): void {}
  draw(): void {}
}

receive(ControlsStyleLab);
