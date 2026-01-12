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
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly step: number;
};

export type SelectDesc = {
  readonly type: "select";
  readonly name: string;
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
  readonly value: string;
  readonly placeholder?: string;
};

export type NumberInputDesc = {
  readonly type: "numberInput";
  readonly name: string;
  readonly value: number;
  readonly placeholder?: string;
};

export type RowDesc = {
  readonly type: "row";
  readonly inputs: InputDesc[];
};

export type SectionDesc = {
  readonly type: "section";
  readonly label: string;
  readonly controls: (RowDesc | InputDesc)[];
};

export type DividerDesc = {
  readonly type: "divider";
};

export type InputDesc =
  | RadioDesc
  | CheckboxDesc
  | SliderDesc
  | SelectDesc
  | StatDesc
  | ButtonDesc
  | TextInputDesc
  | NumberInputDesc;

export type ControlDesc = SectionDesc | RowDesc | InputDesc | DividerDesc;

// ============================================================================
// DESCRIPTOR FACTORY FUNCTIONS
// ============================================================================

export const section = (label: string, controls: (RowDesc | InputDesc)[]): SectionDesc => ({
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

export const slider = (name: string, min: number, max: number, value: number, step = 1): SliderDesc => ({
  type: "slider",
  name,
  min,
  max,
  value,
  step,
});

export const select = (name: string, options: OptionDesc[], selected?: string): SelectDesc => ({
  type: "select",
  name,
  options,
  selected: selected ?? options[0]?.value ?? "",
});

export const option = (label: string, value: string): OptionDesc => ({
  type: "option",
  value,
  label,
});

export const stat = (name: string, value = ""): StatDesc => ({
  type: "stat",
  name,
  value,
});

export const button = (name: string, label?: string): ButtonDesc => ({
  type: "button",
  name,
  label: label ?? name,
});

export const textInput = (name: string, value = "", placeholder?: string): TextInputDesc => ({
  type: "textInput",
  name,
  value,
  placeholder,
});

export const numberInput = (name: string, value = 0, placeholder?: string): NumberInputDesc => ({
  type: "numberInput",
  name,
  value,
  placeholder,
});

export const divider = (): DividerDesc => ({
  type: "divider",
});

// ============================================================================
// CONTROL VALUE TYPE
// ============================================================================

export type ControlValue = string | number | boolean;

// ============================================================================
// LIVE CONTROL WRAPPERS
// ============================================================================

interface LiveControl {
  readonly name: string;
  readonly element: HTMLElement;
  getValue(): ControlValue;
  setValue(value: ControlValue): void;
}

class LiveSlider implements LiveControl {
  constructor(
    readonly name: string,
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
  constructor(readonly name: string, readonly element: HTMLElement, private input: HTMLInputElement) {}

  getValue(): boolean {
    return this.input.checked;
  }

  setValue(value: ControlValue): void {
    this.input.checked = Boolean(value);
  }
}

class LiveRadio implements LiveControl {
  constructor(
    readonly name: string,
    readonly element: HTMLElement,
    private input: HTMLInputElement,
    private radioValue: ControlValue
  ) {}

  getValue(): ControlValue {
    return this.radioValue;
  }

  setValue(value: ControlValue): void {
    this.input.checked = value === this.radioValue;
  }
}

class LiveSelect implements LiveControl {
  constructor(readonly name: string, readonly element: HTMLElement, private selectEl: HTMLSelectElement) {}

  getValue(): string {
    return this.selectEl.value;
  }

  setValue(value: ControlValue): void {
    this.selectEl.value = String(value);
  }
}

class LiveStat implements LiveControl {
  constructor(readonly name: string, readonly element: HTMLElement) {}

  getValue(): string {
    return this.element.textContent ?? "";
  }

  setValue(value: ControlValue): void {
    this.element.textContent = String(value);
  }
}

class LiveTextInput implements LiveControl {
  constructor(readonly name: string, readonly element: HTMLElement, private input: HTMLInputElement) {}

  getValue(): string {
    return this.input.value;
  }

  setValue(value: ControlValue): void {
    this.input.value = String(value);
  }
}

class LiveNumberInput implements LiveControl {
  constructor(readonly name: string, readonly element: HTMLElement, private input: HTMLInputElement) {}

  getValue(): number {
    return Number(this.input.value);
  }

  setValue(value: ControlValue): void {
    this.input.value = String(value);
  }
}

class LiveButton implements LiveControl {
  constructor(readonly name: string, readonly element: HTMLElement) {}

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
    if (value === undefined) {
      throw new Error(`Control "${name}" not found`);
    }
    return value as T;
  }

  /**
   * Try to get a value, returning undefined if not found
   */
  tryGet<T extends ControlValue = ControlValue>(name: string): T | undefined {
    return this.values.get(name) as T | undefined;
  }

  /**
   * Set the value of a control (updates DOM and notifies observers)
   */
  set(name: string, value: ControlValue): this {
    this.values.set(name, value);

    // Update DOM
    const control = this.liveControls.get(name);
    if (control) {
      control.setValue(value);
    }

    // Notify observers
    this.notify(name, value);
    return this;
  }

  /**
   * Observe changes to a control's value
   * Returns an unsubscribe function
   */
  observe<T extends ControlValue = ControlValue>(name: string, callback: Observer<T>): () => void {
    if (!this.observers.has(name)) {
      this.observers.set(name, new Set());
    }
    const cb = callback as Observer;
    this.observers.get(name)!.add(cb);

    // Return unsubscribe function
    return () => {
      this.observers.get(name)?.delete(cb);
    };
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
      controls.register(desc.name, desc.value as ControlValue, new LiveRadio(desc.name, label, input, desc.value));
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

    controls.register(desc.name, desc.checked, new LiveCheckbox(desc.name, label, input));
  }

  private renderSlider(desc: SliderDesc, parent: HTMLElement, controls: Controls): void {
    const container = document.createElement("div");
    container.className = "sketch-controls__slider-container";

    const labelEl = document.createElement("span");
    labelEl.className = "sketch-controls__slider-label";
    labelEl.textContent = desc.name;
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

    controls.register(desc.name, desc.value, new LiveSlider(desc.name, container, input, valueDisplay));
  }

  private renderSelect(desc: SelectDesc, parent: HTMLElement, controls: Controls): void {
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

    parent.appendChild(selectEl);

    controls.register(desc.name, desc.selected, new LiveSelect(desc.name, selectEl, selectEl));
  }

  private renderStat(desc: StatDesc, parent: HTMLElement, controls: Controls): void {
    const stat = document.createElement("div");
    stat.className = "sketch-controls__stat";
    stat.textContent = desc.value;
    parent.appendChild(stat);

    controls.register(desc.name, desc.value, new LiveStat(desc.name, stat));
  }

  private renderButton(desc: ButtonDesc, parent: HTMLElement, controls: Controls): void {
    const btn = document.createElement("button");
    btn.textContent = desc.label;

    btn.addEventListener("click", () => {
      // Notify observers that button was clicked
      controls.updateFromDOM(desc.name, true);
    });

    parent.appendChild(btn);

    controls.register(desc.name, false, new LiveButton(desc.name, btn));
  }

  private renderTextInput(desc: TextInputDesc, parent: HTMLElement, controls: Controls): void {
    const input = document.createElement("input");
    input.type = "text";
    input.value = desc.value;
    if (desc.placeholder) {
      input.placeholder = desc.placeholder;
    }

    input.addEventListener("input", () => {
      controls.updateFromDOM(desc.name, input.value);
    });

    parent.appendChild(input);

    controls.register(desc.name, desc.value, new LiveTextInput(desc.name, input, input));
  }

  private renderNumberInput(desc: NumberInputDesc, parent: HTMLElement, controls: Controls): void {
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(desc.value);
    if (desc.placeholder) {
      input.placeholder = desc.placeholder;
    }

    input.addEventListener("input", () => {
      controls.updateFromDOM(desc.name, Number(input.value));
    });

    parent.appendChild(input);

    controls.register(desc.name, desc.value, new LiveNumberInput(desc.name, input, input));
  }
}
