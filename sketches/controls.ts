import p5 from "p5";

// ============================================================================
// DESCRIPTOR TYPES - Pure data, serializable
// ============================================================================

export type RadioDesc<V = string> = {
  readonly type: "radio";
  readonly name: string;
  readonly value: V;
  readonly label: string;
  readonly selected: boolean;
};

export type CheckboxDesc = {
  readonly type: "checkbox";
  readonly name: string;
  readonly label: string;
  readonly checked: boolean;
};

export type SliderDesc = {
  readonly type: "slider";
  readonly name: string;
  readonly label?: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly step: number;
};

export type SelectDesc = {
  readonly type: "select";
  readonly name: string;
  readonly label?: string;
  readonly options: OptionDesc[];
  readonly selected: string;
};

export type OptionDesc = {
  readonly type: "option";
  readonly value: string;
  readonly label: string;
};

export type StatDesc = {
  readonly type: "stat";
  readonly name: string;
  readonly label?: string;
  readonly value: string;
};

export type ButtonDesc = {
  readonly type: "button";
  readonly name: string;
  readonly label: string;
};

export type TextInputDesc = {
  readonly type: "textInput";
  readonly name: string;
  readonly label?: string;
  readonly value: string;
  readonly placeholder?: string;
};

export type NumberInputDesc = {
  readonly type: "numberInput";
  readonly name: string;
  readonly label?: string;
  readonly value: number;
  readonly placeholder?: string;
};

export type RowDesc = {
  readonly type: "row";
  readonly inputs: InputDesc[];
};

export type DividerDesc = {
  readonly type: "divider";
};

export type SectionDesc = {
  readonly type: "section";
  readonly label: string;
  readonly controls: (RowDesc | InputDesc | TabsDesc | DividerDesc)[];
};

export type TabsDesc = {
  readonly type: "tabs";
  readonly controlName: string;
  readonly panels: Record<string, (RowDesc | InputDesc | DividerDesc)[]>;
};

export type InputDesc<V extends ControlValue = ControlValue> =
  | RadioDesc<V>
  | CheckboxDesc
  | SliderDesc
  | SelectDesc
  | StatDesc
  | ButtonDesc
  | TextInputDesc
  | NumberInputDesc;

export type ControlDesc<V extends ControlValue = ControlValue> =
  | SectionDesc
  | RowDesc
  | InputDesc<V>
  | DividerDesc
  | TabsDesc;

// ============================================================================
// DESCRIPTOR FACTORY FUNCTIONS
// ============================================================================

export const section = (label: string, controls: (RowDesc | InputDesc | TabsDesc | DividerDesc)[]): SectionDesc => ({
  type: "section",
  label,
  controls,
});

export const row = (inputs: InputDesc[]): RowDesc => ({
  type: "row",
  inputs,
});

export const radio = <V extends string | number>(
  name: string,
  value: V,
  label: string,
  selected = false
): RadioDesc<V> => ({
  type: "radio",
  name,
  value,
  label,
  selected,
});

export const checkbox = (name: string, label: string, checked = false): CheckboxDesc => ({
  type: "checkbox",
  name,
  label,
  checked,
});

export const slider = (
  name: string,
  min: number,
  max: number,
  value: number,
  step = 1,
  label?: string
): SliderDesc => ({
  type: "slider",
  name,
  label,
  min,
  max,
  value,
  step,
});

export const select = (name: string, options: OptionDesc[], selected?: string, label?: string): SelectDesc => ({
  type: "select",
  name,
  label,
  options,
  selected: selected ?? options[0]?.value ?? "",
});

export const option = (label: string, value: string): OptionDesc => ({
  type: "option",
  value,
  label,
});

export const stat = (name: string, value = "", label?: string): StatDesc => ({
  type: "stat",
  name,
  label,
  value,
});

export const button = (name: string, label?: string): ButtonDesc => ({
  type: "button",
  name,
  label: label ?? name,
});

export const textInput = (name: string, value = "", placeholder?: string, label?: string): TextInputDesc => ({
  type: "textInput",
  name,
  label,
  value,
  placeholder,
});

export const numberInput = (name: string, value = 0, placeholder?: string, label?: string): NumberInputDesc => ({
  type: "numberInput",
  name,
  label,
  value,
  placeholder,
});

export const divider = (): DividerDesc => ({
  type: "divider",
});

export const tabs = (controlName: string, panels: Record<string, (RowDesc | InputDesc | DividerDesc)[]>): TabsDesc => ({
  type: "tabs",
  controlName,
  panels,
});

// ============================================================================
// CONTROL VALUE TYPE
// ============================================================================

export type ControlValue = string | number | boolean;

// ============================================================================
// LIVE CONTROL WRAPPERS
// ============================================================================

interface LiveControl<V extends ControlValue = ControlValue> {
  readonly desc: InputDesc;
  readonly element: HTMLElement;
  getValue(): V;
  setValue(value: V): void;
}

class LiveSlider implements LiveControl {
  constructor(
    readonly desc: SliderDesc,
    readonly element: HTMLElement,
    private input: HTMLInputElement,
    private valueDisplay: HTMLElement | null
  ) {}

  getValue(): number {
    return Number(this.input.value);
  }

  setValue(value: ControlValue): void {
    this.input.value = String(value);
    if (this.valueDisplay) {
      this.valueDisplay.textContent = String(value);
    }
  }
}

class LiveCheckbox implements LiveControl {
  constructor(readonly desc: CheckboxDesc, readonly element: HTMLElement, private input: HTMLInputElement) {}

  getValue(): boolean {
    return this.input.checked;
  }

  setValue(value: ControlValue): void {
    this.input.checked = Boolean(value);
  }
}

class LiveRadio<V extends ControlValue> implements LiveControl<V> {
  constructor(
    readonly desc: RadioDesc<V>,
    readonly element: HTMLElement,
    private input: HTMLInputElement,
    private radioValue: V
  ) {}

  getValue(): V {
    return this.radioValue;
  }

  setValue(value: V): void {
    this.input.checked = value === this.radioValue;
  }
}

class LiveSelect implements LiveControl {
  constructor(readonly desc: SelectDesc, readonly element: HTMLElement, private selectEl: HTMLSelectElement) {}

  getValue(): string {
    return this.selectEl.value;
  }

  setValue(value: ControlValue): void {
    this.selectEl.value = String(value);
  }
}

class LiveStat implements LiveControl {
  constructor(readonly desc: StatDesc, readonly element: HTMLElement) {}

  getValue(): string {
    return this.element.textContent ?? "";
  }

  setValue(value: ControlValue): void {
    this.element.textContent = String(value);
  }
}

class LiveTextInput implements LiveControl {
  constructor(readonly desc: TextInputDesc, readonly element: HTMLElement, private input: HTMLInputElement) {}

  getValue(): string {
    return this.input.value;
  }

  setValue(value: ControlValue): void {
    this.input.value = String(value);
  }
}

class LiveNumberInput implements LiveControl {
  constructor(readonly desc: NumberInputDesc, readonly element: HTMLElement, private input: HTMLInputElement) {}

  getValue(): number {
    return Number(this.input.value);
  }

  setValue(value: ControlValue): void {
    this.input.value = String(value);
  }
}

class LiveButton implements LiveControl {
  constructor(readonly desc: ButtonDesc, readonly element: HTMLElement) {}

  getValue(): boolean {
    return false; // Buttons don't have a value
  }

  setValue(_value: ControlValue): void {
    // Buttons can't be set
  }
}

// ============================================================================
// CONTROLS CLASS - Observable state container
// ============================================================================

type Observer<T = ControlValue> = (value: T) => void;

export class Controls {
  private values = new Map<string, ControlValue>();
  private observers = new Map<string, Set<Observer>>();
  private liveControls = new Map<string, LiveControl>();
  readonly panel: HTMLElement;

  constructor(panel: HTMLElement) {
    this.panel = panel;
  }

  /**
   * Get the current value of a control
   */
  get<T extends ControlValue = ControlValue>(name: string): T {
    const value = this.values.get(name);
    if (value === undefined) throw new Error(`Control "${name}" not found`);
    return value as T;
  }

  /**
   * Try to get a value, returning undefined if not found
   */
  tryGet<T extends ControlValue = ControlValue>(name: string): T | undefined {
    return this.values.get(name) as T | undefined;
  }

  about<V extends ControlDesc = ControlDesc>(name: string) {
    const control = this.liveControls.get(name);
    if (control !== undefined) return control.desc as V;
  }

  /**
   * Set the value of a control (updates DOM and notifies observers)
   */
  set(name: string, value: ControlValue): this {
    this.values.set(name, value);
    const control = this.liveControls.get(name);
    if (control) control.setValue(value);
    this.notify(name, value);
    return this;
  }

  /**
   * Observe changes to a control's value
   * Returns an unsubscribe function
   */
  subscribe<T extends ControlValue = ControlValue>(name: string, callback: Observer<T>): () => void {
    if (!this.observers.has(name)) this.observers.set(name, new Set());
    const cb = callback as Observer;
    cb(this.get(name));
    this.observers.get(name)!.add(cb);
    return () => this.observers.get(name)?.delete(cb);
  }

  /**
   * Register a control (called by renderer)
   */
  register(name: string, value: ControlValue, control: LiveControl): void {
    this.values.set(name, value);
    this.liveControls.set(name, control);
  }

  /**
   * Update value from DOM event (called by renderer)
   */
  updateFromDOM(name: string, value: ControlValue): void {
    this.values.set(name, value);
    this.notify(name, value);
  }

  private notify(name: string, value: ControlValue): void {
    this.observers.get(name)?.forEach(cb => cb(value));
  }

  /**
   * Check if a control exists
   */
  has(name: string): boolean {
    return this.values.has(name);
  }

  /**
   * Get all control names
   */
  names(): string[] {
    return Array.from(this.values.keys());
  }
}

// ============================================================================
// CONTROLS RENDERER - Transforms descriptors into DOM + Controls
// ============================================================================

export class ControlsRenderer {
  constructor(private p: p5) {}

  render(descriptors: ControlDesc[], container: HTMLElement): Controls {
    const controls = new Controls(container);

    for (const desc of descriptors) {
      this.renderNode(desc, container, controls);
    }

    return controls;
  }

  private renderNode(desc: ControlDesc, parent: HTMLElement, controls: Controls): void {
    switch (desc.type) {
      case "section":
        this.renderSection(desc, parent, controls);
        break;
      case "row":
        this.renderRow(desc, parent, controls);
        break;
      case "divider":
        this.renderDivider(parent);
        break;
      case "radio":
        this.renderRadio(desc, parent, controls);
        break;
      case "checkbox":
        this.renderCheckbox(desc, parent, controls);
        break;
      case "slider":
        this.renderSlider(desc, parent, controls);
        break;
      case "select":
        this.renderSelect(desc, parent, controls);
        break;
      case "stat":
        this.renderStat(desc, parent, controls);
        break;
      case "button":
        this.renderButton(desc, parent, controls);
        break;
      case "textInput":
        this.renderTextInput(desc, parent, controls);
        break;
      case "numberInput":
        this.renderNumberInput(desc, parent, controls);
        break;
      case "tabs":
        this.renderTabs(desc, parent, controls);
        break;
    }
  }

  private renderSection(desc: SectionDesc, parent: HTMLElement, controls: Controls): void {
    const section = document.createElement("div");
    section.className = "sketch-controls__section";

    const label = document.createElement("div");
    label.className = "sketch-controls__label";
    label.textContent = desc.label;
    section.appendChild(label);

    for (const child of desc.controls) {
      this.renderNode(child, section, controls);
    }

    parent.appendChild(section);
  }

  private renderRow(desc: RowDesc, parent: HTMLElement, controls: Controls): void {
    const row = document.createElement("div");
    row.className = "sketch-controls__row";

    for (const input of desc.inputs) {
      this.renderNode(input, row, controls);
    }

    parent.appendChild(row);
  }

  private renderDivider(parent: HTMLElement): void {
    const divider = document.createElement("div");
    divider.className = "sketch-controls__divider";
    parent.appendChild(divider);
  }

  private renderRadio<V extends ControlValue>(desc: RadioDesc<V>, parent: HTMLElement, controls: Controls): void {
    const groupId = `radio-${desc.name}`;

    const label = document.createElement("label");
    label.dataset.radioGroup = groupId;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupId;
    input.value = String(desc.value);
    input.checked = desc.selected;

    input.addEventListener("change", () => {
      if (input.checked) {
        controls.updateFromDOM(desc.name, desc.value as ControlValue);
      }
    });

    const span = document.createElement("span");
    span.textContent = desc.label;

    label.appendChild(input);
    label.appendChild(span);
    parent.appendChild(label);

    // Add hover handlers for group indication
    this.addRadioGroupHoverHandlers(label, groupId);

    // Register with initial value if selected
    if (desc.selected) {
      controls.register(desc.name, desc.value as ControlValue, new LiveRadio<V>(desc, label, input, desc.value));
    }
  }

  private addRadioGroupHoverHandlers(label: HTMLLabelElement, groupId: string): void {
    label.addEventListener("mouseenter", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        if (sibling !== label) {
          sibling.classList.add("radio-group-hover");
        }
      });
    });

    label.addEventListener("mouseleave", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        sibling.classList.remove("radio-group-hover");
      });
    });
  }

  private renderCheckbox(desc: CheckboxDesc, parent: HTMLElement, controls: Controls): void {
    const label = document.createElement("label");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = desc.checked;

    input.addEventListener("change", () => {
      controls.updateFromDOM(desc.name, input.checked);
    });

    const span = document.createElement("span");
    span.textContent = desc.label;

    label.appendChild(input);
    label.appendChild(span);
    parent.appendChild(label);

    controls.register(desc.name, desc.checked, new LiveCheckbox(desc, label, input));
  }

  private renderSlider(desc: SliderDesc, parent: HTMLElement, controls: Controls): void {
    const container = document.createElement("div");
    container.className = "sketch-controls__slider-container";

    const labelEl = document.createElement("span");
    labelEl.className = "sketch-controls__slider-label";
    labelEl.textContent = desc.label ?? desc.name;
    container.appendChild(labelEl);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(desc.min);
    input.max = String(desc.max);
    input.step = String(desc.step);
    input.value = String(desc.value);

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "sketch-controls__slider-value";
    valueDisplay.textContent = String(desc.value);

    input.addEventListener("input", () => {
      const val = Number(input.value);
      valueDisplay.textContent = String(val);
      controls.updateFromDOM(desc.name, val);
    });

    container.appendChild(input);
    container.appendChild(valueDisplay);
    parent.appendChild(container);

    controls.register(desc.name, desc.value, new LiveSlider(desc, container, input, valueDisplay));
  }

  private renderSelect(desc: SelectDesc, parent: HTMLElement, controls: Controls): void {
    const container = desc.label ? document.createElement("label") : null;

    const selectEl = document.createElement("select");

    for (const opt of desc.options) {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      if (opt.value === desc.selected) {
        optionEl.selected = true;
      }
      selectEl.appendChild(optionEl);
    }

    selectEl.addEventListener("change", () => {
      controls.updateFromDOM(desc.name, selectEl.value);
    });

    if (container) {
      const span = document.createElement("span");
      span.textContent = desc.label!;
      container.appendChild(span);
      container.appendChild(selectEl);
      parent.appendChild(container);
    } else {
      parent.appendChild(selectEl);
    }

    controls.register(desc.name, desc.selected, new LiveSelect(desc, container ?? selectEl, selectEl));
  }

  private renderStat(desc: StatDesc, parent: HTMLElement, controls: Controls): void {
    const container = document.createElement("div");
    container.className = "sketch-controls__stat";

    if (desc.label) {
      const labelEl = document.createElement("span");
      labelEl.className = "sketch-controls__stat-label";
      labelEl.textContent = desc.label;
      container.appendChild(labelEl);
    }

    const valueEl = document.createElement("span");
    valueEl.className = "sketch-controls__stat-value";
    valueEl.textContent = desc.value;
    container.appendChild(valueEl);

    parent.appendChild(container);

    controls.register(desc.name, desc.value, new LiveStat(desc, valueEl));
  }

  private renderButton(desc: ButtonDesc, parent: HTMLElement, controls: Controls): void {
    const btn = document.createElement("button");
    btn.textContent = desc.label;

    btn.addEventListener("click", () => {
      // Notify observers that button was clicked
      controls.updateFromDOM(desc.name, true);
    });

    parent.appendChild(btn);

    controls.register(desc.name, false, new LiveButton(desc, btn));
  }

  private renderTextInput(desc: TextInputDesc, parent: HTMLElement, controls: Controls): void {
    const container = desc.label ? document.createElement("label") : null;

    const input = document.createElement("input");
    input.type = "text";
    input.value = desc.value;
    if (desc.placeholder) {
      input.placeholder = desc.placeholder;
    }

    input.addEventListener("input", () => {
      controls.updateFromDOM(desc.name, input.value);
    });

    if (container) {
      const span = document.createElement("span");
      span.textContent = desc.label!;
      container.appendChild(span);
      container.appendChild(input);
      parent.appendChild(container);
    } else {
      parent.appendChild(input);
    }

    controls.register(desc.name, desc.value, new LiveTextInput(desc, container ?? input, input));
  }

  private renderNumberInput(desc: NumberInputDesc, parent: HTMLElement, controls: Controls): void {
    const container = desc.label ? document.createElement("label") : null;

    const input = document.createElement("input");
    input.type = "number";
    input.value = String(desc.value);
    if (desc.placeholder) {
      input.placeholder = desc.placeholder;
    }

    input.addEventListener("input", () => {
      controls.updateFromDOM(desc.name, Number(input.value));
    });

    if (container) {
      const span = document.createElement("span");
      span.textContent = desc.label!;
      container.appendChild(span);
      container.appendChild(input);
      parent.appendChild(container);
    } else {
      parent.appendChild(input);
    }

    controls.register(desc.name, desc.value, new LiveNumberInput(desc, container ?? input, input));
  }

  private renderTabs(desc: TabsDesc, parent: HTMLElement, controls: Controls): void {
    const container = document.createElement("div");
    container.className = "sketch-controls__tabs";

    // Create panel containers for each tab
    const panelElements = new Map<string, HTMLElement>();

    for (const [key, panelControls] of Object.entries(desc.panels)) {
      const panel = document.createElement("div");
      panel.className = "sketch-controls__tab-panel";
      panel.dataset.tabKey = key;

      // Render controls into this panel
      for (const child of panelControls) {
        this.renderNode(child, panel, controls);
      }

      container.appendChild(panel);
      panelElements.set(key, panel);
    }

    parent.appendChild(container);

    // Subscribe to the control to show/hide panels
    const updateVisibility = (value: ControlValue) => {
      const activeKey = String(value);
      for (const [key, panel] of panelElements) {
        panel.style.display = key === activeKey ? "" : "none";
      }
    };

    // Initial visibility based on current value (or first key as fallback)
    const currentValue = controls.tryGet(desc.controlName);
    if (currentValue !== undefined) {
      updateVisibility(currentValue);
    } else {
      // Control not yet registered, use first panel as default
      const firstKey = Object.keys(desc.panels)[0];
      if (firstKey) updateVisibility(firstKey);
    }

    // Subscribe to changes
    controls.subscribe(desc.controlName, updateVisibility);
  }
}

// ============================================================================
// LEGACY IMPERATIVE API - Backward compatibility layer
// ============================================================================

/**
 * A p5.Element-like wrapper for DOM elements in the legacy API
 */
export class LegacyElement {
  constructor(public readonly elt: HTMLElement) {}

  html(content: string): this {
    this.elt.innerHTML = content;
    return this;
  }

  addClass(className: string): this {
    this.elt.classList.add(className);
    return this;
  }

  removeClass(className: string): this {
    this.elt.classList.remove(className);
    return this;
  }

  style(property: string, value: string): this {
    (this.elt.style as unknown as Record<string, string>)[property] = value;
    return this;
  }

  mouseClicked(callback: () => void): this {
    this.elt.addEventListener("click", callback);
    return this;
  }

  parent(parent: HTMLElement | LegacyElement | SectionBuilder): this {
    const el =
      parent instanceof LegacyElement ? parent.elt : parent instanceof SectionBuilder ? parent.section : parent;
    el.appendChild(this.elt);
    return this;
  }

  attribute(name: string, value: string): this {
    this.elt.setAttribute(name, value);
    return this;
  }

  value(): string {
    return (this.elt as HTMLInputElement | HTMLSelectElement).value;
  }

  class(className: string): this {
    this.elt.className = className;
    return this;
  }
}

/**
 * Legacy control wrappers that match the old API
 */
export class ButtonControl {
  constructor(readonly element: LegacyElement, private clickHandler: () => void) {}

  click(): void {
    this.clickHandler();
  }
}

export class SliderControl {
  constructor(
    readonly element: LegacyElement,
    private input: HTMLInputElement,
    private valueDisplay: HTMLElement | null,
    private changeCallback: (value: number) => void
  ) {}

  getValue(): number {
    return Number(this.input.value);
  }

  setValue(value: number): this {
    this.input.value = String(value);
    if (this.valueDisplay) {
      this.valueDisplay.textContent = String(value);
    }
    return this;
  }

  change(): this {
    this.changeCallback(this.getValue());
    return this;
  }
}

export class CheckboxControl {
  constructor(
    readonly element: LegacyElement,
    private input: HTMLInputElement,
    private changeCallback: (checked: boolean) => void
  ) {}

  isChecked(): boolean {
    return this.input.checked;
  }

  toggle(): this {
    this.input.checked = !this.input.checked;
    this.changeCallback(this.input.checked);
    return this;
  }
}

export class SelectControl {
  constructor(
    readonly element: LegacyElement,
    private selectEl: HTMLSelectElement,
    private changeCallback: (value: string) => void
  ) {}

  getValue(): string {
    return this.selectEl.value;
  }

  setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }

  change(): this {
    this.changeCallback(this.getValue());
    return this;
  }
}

export class StatControl {
  constructor(readonly element: LegacyElement) {}

  setText(text: string): this {
    this.element.html(text);
    return this;
  }
}

/**
 * Row builder for fluent API
 */
export class RowBuilder {
  readonly row: HTMLElement;
  private controls = new Map<string, ButtonControl | CheckboxControl | SliderControl | SelectControl>();
  private readonly p: p5;
  private readonly parent: ControlsBuilder;

  constructor(p: p5, parent: ControlsBuilder, label?: string) {
    this.p = p;
    this.parent = parent;
    this.row = document.createElement("div");
    this.row.className = "sketch-controls__row";
    if (label) {
      this.row.dataset.label = label;
    }
  }

  button(label: string, callback: () => void): this {
    const btn = document.createElement("button");
    btn.className = "sketch-controls__button";
    btn.textContent = label;
    btn.addEventListener("click", callback);
    this.row.appendChild(btn);
    this.controls.set(label, new ButtonControl(new LegacyElement(btn), callback));
    return this;
  }

  radio<V extends string>(
    name: string,
    value: V,
    label: string,
    selected = false,
    callback?: (value: V) => void
  ): this {
    const groupId = `radio-${name}`;

    const labelEl = document.createElement("label");
    labelEl.dataset.radioGroup = groupId;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupId;
    input.value = value;
    input.checked = selected;

    input.addEventListener("change", () => {
      if (input.checked && callback) {
        callback(value);
      }
    });

    // Trigger callback immediately if selected
    if (selected && callback) {
      callback(value);
    }

    const span = document.createElement("span");
    span.textContent = label;

    labelEl.appendChild(input);
    labelEl.appendChild(span);
    this.row.appendChild(labelEl);

    return this;
  }

  checkbox(name: string, label: string, checked = false, callback?: (checked: boolean) => void): this {
    const labelEl = document.createElement("label");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;

    input.addEventListener("change", () => {
      if (callback) callback(input.checked);
    });

    // Trigger callback immediately with initial value
    if (callback) callback(checked);

    const span = document.createElement("span");
    span.textContent = label;

    labelEl.appendChild(input);
    labelEl.appendChild(span);
    this.row.appendChild(labelEl);

    const control = new CheckboxControl(new LegacyElement(labelEl), input, callback ?? (() => {}));
    this.controls.set(name, control);
    return this;
  }

  endRow(): ControlsBuilder {
    return this.parent;
  }

  get<T>(name: string): T {
    return this.controls.get(name) as T;
  }
}

/**
 * Section builder for fluent API
 */
export class SectionBuilder {
  readonly section: HTMLElement;
  private controls = new Map<
    string,
    RowBuilder | ButtonControl | SliderControl | CheckboxControl | SelectControl | StatControl
  >();
  private rows = new Map<string, RowBuilder>();
  private readonly p: p5;
  private readonly parent: ControlsBuilder;

  constructor(p: p5, parent: ControlsBuilder, label: string) {
    this.p = p;
    this.parent = parent;
    this.section = document.createElement("div");
    this.section.className = "sketch-controls__section";

    const labelEl = document.createElement("div");
    labelEl.className = "sketch-controls__label";
    labelEl.textContent = label;
    this.section.appendChild(labelEl);
  }

  addButton(label: string, callback: () => void): p5.Element {
    const btn = this.p.createButton(label);
    btn.class("sketch-controls__button");
    btn.mouseClicked(callback);
    btn.parent(this.section);
    return btn;
  }

  addNumberInput(label: string, value: string, callback: (value: number) => void): p5.Element {
    const container = this.p.createDiv();
    container.class("sketch-controls__input-group");

    const span = this.p.createSpan(label);
    span.parent(container);

    const input = this.p.createInput(value, "number");
    input.class("sketch-controls__input");
    // deno-lint-ignore no-explicit-any
    (input as any).input(() => {
      callback(Number(input.value()));
    });
    input.parent(container);

    container.parent(this.section);
    return container;
  }

  addStat(): p5.Element {
    const stat = this.p.createDiv();
    stat.class("sketch-controls__stat");
    stat.parent(this.section);
    return stat;
  }

  addHighlight(text = ""): p5.Element {
    const highlight = this.p.createDiv();
    highlight.class("sketch-controls__highlight");
    highlight.html(text);
    highlight.parent(this.section);
    return highlight;
  }

  row(label?: string): RowBuilder {
    const rowBuilder = new RowBuilder(this.p, this.parent, label);
    this.section.appendChild(rowBuilder.row);
    if (label) {
      this.rows.set(label, rowBuilder);
      this.controls.set(label, rowBuilder);
    }
    // Return the row builder but also register it so endRow can return to parent
    return rowBuilder;
  }

  button(label: string, callback: () => void): ControlsBuilder {
    const btn = document.createElement("button");
    btn.className = "sketch-controls__button";
    btn.textContent = label;
    btn.addEventListener("click", callback);
    this.section.appendChild(btn);
    this.controls.set(label, new ButtonControl(new LegacyElement(btn), callback));
    return this.parent;
  }

  slider(
    name: string,
    min: number,
    max: number,
    value: number,
    step: number,
    callback: (value: number) => void
  ): ControlsBuilder {
    const container = document.createElement("div");
    container.className = "sketch-controls__slider-container";

    const labelEl = document.createElement("span");
    labelEl.className = "sketch-controls__slider-label";
    labelEl.textContent = name;
    container.appendChild(labelEl);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);

    const valueDisplay = document.createElement("span");
    valueDisplay.className = "sketch-controls__slider-value";
    valueDisplay.textContent = String(value);

    input.addEventListener("input", () => {
      const val = Number(input.value);
      valueDisplay.textContent = String(val);
      callback(val);
    });

    // Trigger callback with initial value
    callback(value);

    container.appendChild(input);
    container.appendChild(valueDisplay);
    this.section.appendChild(container);

    this.controls.set(name, new SliderControl(new LegacyElement(container), input, valueDisplay, callback));
    return this.parent;
  }

  checkbox(name: string, label: string, checked = false, callback?: (checked: boolean) => void): ControlsBuilder {
    const labelEl = document.createElement("label");

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;

    input.addEventListener("change", () => {
      if (callback) callback(input.checked);
    });

    // Trigger callback immediately with initial value
    if (callback) callback(checked);

    const span = document.createElement("span");
    span.textContent = label;

    labelEl.appendChild(input);
    labelEl.appendChild(span);
    this.section.appendChild(labelEl);

    this.controls.set(name, new CheckboxControl(new LegacyElement(labelEl), input, callback ?? (() => {})));
    return this.parent;
  }

  select(name: string, options: string[], callback: (value: string) => void): ControlsBuilder {
    const container = document.createElement("label");

    const span = document.createElement("span");
    span.textContent = name;
    container.appendChild(span);

    const selectEl = document.createElement("select");
    for (const opt of options) {
      const optionEl = document.createElement("option");
      optionEl.value = opt;
      optionEl.textContent = opt;
      selectEl.appendChild(optionEl);
    }

    selectEl.addEventListener("change", () => {
      callback(selectEl.value);
    });

    // Trigger callback with initial value
    if (options.length > 0) {
      callback(options[0]);
    }

    container.appendChild(selectEl);
    this.section.appendChild(container);

    this.controls.set(name, new SelectControl(new LegacyElement(container), selectEl, callback));
    return this.parent;
  }

  textInput(name: string, value: string, callback: (value: string) => void): ControlsBuilder {
    const container = document.createElement("label");
    container.className = "sketch-controls__input-group";

    const span = document.createElement("span");
    span.textContent = name;
    container.appendChild(span);

    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.className = "sketch-controls__input";
    input.addEventListener("input", () => {
      callback(input.value);
    });
    container.appendChild(input);

    this.section.appendChild(container);
    return this.parent;
  }

  stat(name: string, value = ""): ControlsBuilder {
    const stat = document.createElement("div");
    stat.className = "sketch-controls__stat";
    stat.textContent = value;
    this.section.appendChild(stat);
    this.controls.set(name, new StatControl(new LegacyElement(stat)));
    return this.parent;
  }

  highlight(name: string, text: string): ControlsBuilder {
    const highlight = document.createElement("div");
    highlight.className = "sketch-controls__highlight";
    highlight.innerHTML = text;
    this.section.appendChild(highlight);
    this.controls.set(name, new StatControl(new LegacyElement(highlight)));
    return this.parent;
  }

  get<T>(name: string): T {
    return this.controls.get(name) as T;
  }
}

/**
 * Legacy controls builder - imperative/fluent API
 * Used by old sketches that don't use the declarative descriptor pattern
 */
export class ControlsBuilder {
  readonly panel: HTMLElement;
  private sections = new Map<string, SectionBuilder>();
  private currentSection: SectionBuilder | null = null;
  private currentRow: RowBuilder | null = null;
  private readonly p: p5;

  constructor(p: p5) {
    this.p = p;
    this.panel = document.createElement("div");
    this.panel.className = "sketch-controls";
  }

  /**
   * Add a section with the imperative API (returns SectionBuilder)
   */
  addSection(_p: p5, label: string): SectionBuilder {
    const section = new SectionBuilder(this.p, this, label);
    this.panel.appendChild(section.section);
    this.sections.set(label, section);
    return section;
  }

  /**
   * Add a divider
   */
  addDivider(_p: p5): void {
    const divider = document.createElement("div");
    divider.className = "sketch-controls__divider";
    this.panel.appendChild(divider);
  }

  /**
   * Start a section with fluent API
   */
  section(label: string): this {
    const section = new SectionBuilder(this.p, this, label);
    this.panel.appendChild(section.section);
    this.sections.set(label, section);
    this.currentSection = section;
    return this;
  }

  /**
   * Start a row in current section
   */
  row(label?: string): RowBuilder {
    if (!this.currentSection) {
      throw new Error("Must call section() before row()");
    }
    const row = this.currentSection.row(label);
    this.currentRow = row;
    return row;
  }

  /**
   * Add a divider with fluent API
   */
  divider(): this {
    const divider = document.createElement("div");
    divider.className = "sketch-controls__divider";
    if (this.currentSection) {
      this.currentSection.section.appendChild(divider);
    } else {
      this.panel.appendChild(divider);
    }
    return this;
  }

  /**
   * Get a section by name
   */
  get(name: string): SectionBuilder {
    const section = this.sections.get(name);
    if (!section) throw new Error(`Section "${name}" not found`);
    return section;
  }

  /**
   * Fluent slider in current section
   */
  slider(name: string, min: number, max: number, value: number, step: number, callback: (value: number) => void): this {
    if (!this.currentSection) {
      throw new Error("Must call section() before slider()");
    }
    this.currentSection.slider(name, min, max, value, step, callback);
    return this;
  }

  /**
   * Fluent checkbox in current section
   */
  checkbox(name: string, label: string, checked: boolean, callback: (checked: boolean) => void): this {
    if (!this.currentSection) {
      throw new Error("Must call section() before checkbox()");
    }
    this.currentSection.checkbox(name, label, checked, callback);
    return this;
  }

  /**
   * Fluent select in current section
   */
  select(name: string, options: string[], callback: (value: string) => void): this {
    if (!this.currentSection) {
      throw new Error("Must call section() before select()");
    }
    this.currentSection.select(name, options, callback);
    return this;
  }

  /**
   * Fluent stat in current section
   */
  stat(name: string, value = ""): this {
    if (!this.currentSection) {
      throw new Error("Must call section() before stat()");
    }
    this.currentSection.stat(name, value);
    return this;
  }

  /**
   * Fluent textInput in current section
   */
  textInput(name: string, value: string, callback: (value: string) => void): this {
    if (!this.currentSection) {
      throw new Error("Must call section() before textInput()");
    }
    this.currentSection.textInput(name, value, callback);
    return this;
  }

  /**
   * Fluent highlight in current section
   */
  highlight(name: string, text: string): this {
    if (!this.currentSection) {
      throw new Error("Must call section() before highlight()");
    }
    this.currentSection.highlight(name, text);
    return this;
  }

  /**
   * Fluent button in current section
   */
  button(label: string, callback: () => void): this {
    if (!this.currentSection) {
      throw new Error("Must call section() before button()");
    }
    this.currentSection.button(label, callback);
    return this;
  }
}
