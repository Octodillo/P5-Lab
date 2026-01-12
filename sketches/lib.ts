import p5 from "p5";
import { EventEmitter } from "https://esm.sh/jsr/@denosaurs/event";
import { Controls, ControlsRenderer, ControlDesc } from "./controls.ts";

// deno-lint-ignore no-explicit-any
type AnyWindow = Window & typeof globalThis & { [key: string]: any };

/**
 * Unified framework for creating sketches with controls
 *
 * Supports two signatures:
 * 1. Declarative: new SketchController(descriptors[], (p, controls) => { ... })
 * 2. Legacy fluent: new SketchController((p, controlsBuilder) => { ... })
 */
export class SketchController {
  private p5Instance: p5 | null = null;
  private controlsPanel: HTMLElement | p5.Element | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private descriptors: ControlDesc[] | null = null;
  private declarativeSketchFn: ((p: p5, controls: Controls) => void) | null = null;
  private legacySketchFn: ((p: p5, controls: ControlsBuilder) => void) | null = null;

  constructor(descriptors: ControlDesc[], sketchFn: (p: p5, controls: Controls) => void);
  constructor(sketchFn: (p: p5, controls: ControlsBuilder) => void);
  constructor(
    descriptorsOrSketchFn: ControlDesc[] | ((p: p5, controls: ControlsBuilder) => void),
    sketchFn?: (p: p5, controls: Controls) => void
  ) {
    if (Array.isArray(descriptorsOrSketchFn)) {
      // Declarative API
      this.descriptors = descriptorsOrSketchFn;
      this.declarativeSketchFn = sketchFn!;
    } else {
      // Legacy fluent API
      this.legacySketchFn = descriptorsOrSketchFn;
    }
  }

  /**
   * Initialize the sketch
   */
  init(): p5 {
    const container = document.getElementById("sketch-container")!;

    this.p5Instance = new p5((p: p5) => {
      // Setup resize observer to keep canvas sized to container
      this.resizeObserver = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          p.resizeCanvas(width, height);
        }
      });
      this.resizeObserver.observe(container);

      if (this.descriptors && this.declarativeSketchFn) {
        // Declarative API path
        const panel = document.createElement("div");
        panel.className = "sketch-controls";

        const renderer = new ControlsRenderer(p);
        const controls = renderer.render(this.descriptors, panel);

        this.declarativeSketchFn(p, controls);

        this.controlsPanel = panel;

        // Hide controls initially - they'll be moved to sidebar by index.js
        panel.style.display = "none";
        document.body.appendChild(panel);
      } else if (this.legacySketchFn) {
        // Legacy fluent API path
        const controlsBuilder = new ControlsBuilder(p);

        this.legacySketchFn(p, controlsBuilder);

        // Store controls panel reference after sketch setup
        this.controlsPanel = controlsBuilder.getPanel();

        // Hide controls initially - they'll be moved to sidebar by index.js
        if (this.controlsPanel) {
          (this.controlsPanel.elt as HTMLElement).style.display = "none";
        }
      }
    }, container);

    // Store globally for cleanup
    (window as AnyWindow).__p5_instance__ = this.p5Instance;
    (window as AnyWindow).__controls_ready__ = true;

    // Wire into global controls
    const globalControls = GlobalControls.getInstance();
    globalControls.wire(this.p5Instance);

    return this.p5Instance;
  }

  /**
   * Get the controls panel element
   */
  getControls(): HTMLElement | p5.Element | null {
    return this.controlsPanel;
  }
}

// ============================================================================
// Fluent Controls API
// ============================================================================

/**
 * Base interface for all control elements that can be retrieved by name
 */
interface ControlElement {
  readonly element: p5.Element;
  readonly name: string;
}

/**
 * Button control with click functionality
 */
export class ButtonControl implements ControlElement {
  constructor(readonly name: string, readonly element: p5.Element, private onClick: () => void) {}

  click(): this {
    this.onClick();
    return this;
  }

  setActive(active: boolean): this {
    if (active) {
      this.element.addClass("active");
    } else {
      this.element.removeClass("active");
    }
    return this;
  }

  disable(): this {
    this.element.attribute("disabled", "true");
    return this;
  }

  enable(): this {
    this.element.removeAttribute("disabled");
    return this;
  }
}

/**
 * Select dropdown control
 */
export class SelectControl implements ControlElement {
  constructor(readonly name: string, readonly element: p5.Element, private onChange: (value: string) => void) {}

  value(): string {
    return this.element.value() as string;
  }

  setValue(value: string): this {
    (this.element.elt as HTMLSelectElement).value = value;
    return this;
  }

  change(): this {
    this.onChange(this.value());
    return this;
  }
}

/**
 * Number input control
 */
export class NumberInputControl implements ControlElement {
  readonly submitButton?: p5.Element;

  constructor(
    readonly name: string,
    readonly element: p5.Element,
    private onSubmit?: (value: number) => void,
    submitButton?: p5.Element
  ) {
    this.submitButton = submitButton;
  }

  value(): number {
    return Number(this.element.value());
  }

  setValue(value: number): this {
    this.element.value(String(value));
    return this;
  }

  submit(): this {
    this.onSubmit?.(this.value());
    return this;
  }
}

/**
 * Text input control
 */
export class TextInputControl implements ControlElement {
  constructor(readonly name: string, readonly element: p5.Element, private onInput?: (value: string) => void) {}

  value(): string {
    return this.element.value() as string;
  }

  setValue(value: string): this {
    this.element.value(value);
    return this;
  }

  input(): this {
    this.onInput?.(this.value());
    return this;
  }
}

/**
 * Stat display control (read-only text)
 */
export class StatControl implements ControlElement {
  constructor(readonly name: string, readonly element: p5.Element) {}

  text(): string {
    return this.element.html() as string;
  }

  setText(text: string): this {
    this.element.html(text);
    return this;
  }
}

/**
 * Highlight display control
 */
export class HighlightControl implements ControlElement {
  constructor(readonly name: string, readonly element: p5.Element) {}

  text(): string {
    return this.element.html() as string;
  }

  setText(text: string): this {
    this.element.html(text);
    return this;
  }
}

/**
 * Checkbox control
 */
export class CheckboxControl implements ControlElement {
  constructor(readonly name: string, readonly element: p5.Element, private onChange: (checked: boolean) => void) {}

  checked(): boolean {
    return (this.element.elt as HTMLInputElement).checked;
  }

  setChecked(checked: boolean): this {
    (this.element.elt as HTMLInputElement).checked = checked;
    return this;
  }

  toggle(): this {
    this.setChecked(!this.checked());
    this.onChange(this.checked());
    return this;
  }
}

/**
 * Slider control
 */
export class SliderControl implements ControlElement {
  constructor(readonly name: string, readonly element: p5.Element, private onChange: (value: number) => void) {}

  value(): number {
    return Number(this.element.value());
  }

  setValue(value: number): this {
    this.element.value(value);
    return this;
  }

  change(): this {
    this.onChange(this.value());
    return this;
  }
}

/**
 * Radio group control - a group of mutually exclusive options
 * @deprecated Use individual radio() controls instead
 */
export class RadioGroupControl implements ControlElement {
  private radios: Map<string, HTMLInputElement> = new Map();

  constructor(readonly name: string, readonly element: p5.Element, private onChange: (value: string) => void) {}

  /** Register a radio button in this group */
  registerRadio(value: string, input: HTMLInputElement): void {
    this.radios.set(value, input);
  }

  value(): string {
    for (const [val, input] of this.radios) {
      if (input.checked) return val;
    }
    return "";
  }

  setValue(value: string): this {
    const radio = this.radios.get(value);
    if (radio) {
      radio.checked = true;
    }
    return this;
  }

  change(): this {
    this.onChange(this.value());
    return this;
  }
}

/**
 * Individual radio control within a group
 */
export class RadioControl<Names extends string> implements ControlElement {
  constructor(
    readonly name: Names,
    readonly group: string,
    readonly element: p5.Element,
    private onChange: (value: Names) => void
  ) {}

  checked(): boolean {
    return (this.element.elt as HTMLInputElement).checked;
  }

  setChecked(checked: boolean): this {
    (this.element.elt as HTMLInputElement).checked = checked;
    return this;
  }

  select(): this {
    this.setChecked(true);
    this.onChange(this.name);
    return this;
  }
}

type AnyControl =
  | ButtonControl
  | SelectControl
  | NumberInputControl
  | TextInputControl
  | StatControl
  | HighlightControl
  | CheckboxControl
  | SliderControl
  | RadioGroupControl
  // deno-lint-ignore no-explicit-any
  | RadioControl<any>
  | RowBuilder
  | SectionBuilder;

/**
 * Row builder for grouping controls horizontally
 */
export class RowBuilder {
  readonly element: p5.Element;
  private controls = new Map<string, AnyControl>();
  private parent: SectionBuilder;

  constructor(private p: p5, readonly name: string, parent: SectionBuilder) {
    this.parent = parent;
    this.element = p.createDiv();
    this.element.class("sketch-controls__row");
  }

  /**
   * Add a button to the row
   */
  button(label: string, onClick: () => void): this {
    const button = this.p.createButton(label);
    button.mouseClicked(onClick);
    button.parent(this.element);
    this.controls.set(label, new ButtonControl(label, button, onClick));
    return this;
  }

  /**
   * Add a select dropdown to the row
   */
  select(name: string, options: string[], onChange: (value: string) => void): this {
    const select = this.p.createSelect() as p5.Element & { option: (opt: string) => void };
    options.forEach(opt => select.option(opt));
    select.elt.addEventListener("change", () => onChange(select.value() as string));
    select.parent(this.element);
    this.controls.set(name, new SelectControl(name, select, onChange));
    return this;
  }

  /**
   * Add a number input to the row
   */
  numberInput(name: string, defaultValue: number, onSubmit?: (value: number) => void): this {
    const input = this.p.createInput(String(defaultValue), "number");
    input.attribute("placeholder", name);
    input.parent(this.element);

    let submitButton: p5.Element | undefined;
    if (onSubmit) {
      submitButton = this.p.createButton("Set");
      submitButton.mouseClicked(() => onSubmit(Number(input.value())));
      submitButton.parent(this.element);
    }

    this.controls.set(name, new NumberInputControl(name, input, onSubmit, submitButton));
    return this;
  }

  /**
   * Add a text input to the row
   */
  textInput(name: string, defaultValue: string, onInput?: (value: string) => void): this {
    const input = this.p.createInput(defaultValue, "text");
    input.attribute("placeholder", name);
    if (onInput) {
      (input.elt as HTMLInputElement).addEventListener("input", () => onInput(input.value() as string));
    }
    input.parent(this.element);
    this.controls.set(name, new TextInputControl(name, input, onInput));
    return this;
  }

  /**
   * Add a stat display to the row
   */
  stat(name: string, initialText: string = ""): this {
    const stat = this.p.createDiv(initialText);
    stat.class("sketch-controls__stat");
    stat.parent(this.element);
    this.controls.set(name, new StatControl(name, stat));
    return this;
  }

  /**
   * Add a checkbox to the row
   */
  checkbox(name: string, labelText: string, defaultChecked: boolean, onChange: (checked: boolean) => void): this {
    // Create checkbox using DOM directly (not p5) for better control over structure
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = defaultChecked;
    input.addEventListener("change", () => onChange(input.checked));

    const span = document.createElement("span");
    span.textContent = labelText;

    label.appendChild(input);
    label.appendChild(span);
    this.element.elt.appendChild(label);

    // Wrap in a minimal p5.Element-like object for CheckboxControl
    const wrapper = { elt: input } as p5.Element;
    this.controls.set(name, new CheckboxControl(name, wrapper, onChange));
    return this;
  }

  /**
   * Add a slider to the row
   */
  slider(
    label: string,
    min: number,
    max: number,
    defaultValue: number,
    step: number,
    onChange: (value: number) => void
  ): this {
    const container = this.p.createDiv();
    container.class("sketch-controls__slider-container");
    container.parent(this.element);

    const labelEl = this.p.createSpan(label);
    labelEl.class("sketch-controls__slider-label");
    labelEl.parent(container);

    const slider = this.p.createSlider(min, max, defaultValue, step);
    (slider.elt as HTMLInputElement).addEventListener("input", () => onChange(Number(slider.value())));
    slider.parent(container);
    this.controls.set(label, new SliderControl(label, slider, onChange));
    return this;
  }

  /**
   * Add a radio group to the row
   * @deprecated Use individual radio() controls instead for better flexibility
   */
  radioGroup(name: string, options: string[], defaultValue: string, onChange: (value: string) => void): this {
    const groupId = `radio-${name}-${Date.now()}`;
    const container = this.p.createDiv();
    container.class("sketch-controls__radio-group-inline");
    container.parent(this.element);

    const radioControl = new RadioGroupControl(name, container, onChange);

    options.forEach(option => {
      const label = document.createElement("label");
      label.dataset.radioGroup = groupId;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = groupId;
      input.value = option;
      input.checked = option === defaultValue;
      input.addEventListener("change", () => {
        if (input.checked) onChange(option);
      });

      const span = document.createElement("span");
      span.textContent = option;

      label.appendChild(input);
      label.appendChild(span);
      container.elt.appendChild(label);

      // Add hover handlers for group indication
      this.addRadioGroupHoverHandlers(label, groupId);

      radioControl.registerRadio(option, input);
    });

    this.controls.set(name, radioControl);
    return this;
  }

  /**
   * Add a radio button to the row. Multiple radios with the same group name
   * are mutually exclusive.
   */
  radio<Names extends string = string>(
    group: string,
    name: Names,
    labelText: string,
    defaultChecked: boolean,
    onChange: (value: Names) => void
  ): this {
    const groupId = `radio-${group}`;

    const label = document.createElement("label");
    label.dataset.radioGroup = groupId;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupId;
    input.value = name;
    input.checked = defaultChecked;
    input.addEventListener("change", () => {
      if (input.checked) onChange(name);
    });

    const span = document.createElement("span");
    span.textContent = labelText;

    label.appendChild(input);
    label.appendChild(span);
    this.element.elt.appendChild(label);

    // Add hover handlers for group indication
    this.addRadioGroupHoverHandlers(label, groupId);

    // Wrap in a minimal p5.Element-like object for RadioControl
    const wrapper = { elt: input } as p5.Element;
    this.controls.set(name, new RadioControl(name, group, wrapper, onChange));
    return this;
  }

  /**
   * Add hover handlers to a radio label to highlight sibling radios in the same group
   */
  private addRadioGroupHoverHandlers(label: HTMLLabelElement, groupId: string): void {
    label.addEventListener("mouseenter", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        if (sibling !== label) {
          sibling.classList.add("radio-group-sibling-hover");
        }
      });
    });

    label.addEventListener("mouseleave", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        sibling.classList.remove("radio-group-sibling-hover");
      });
    });
  }

  /**
   * End the row and return to the parent section
   */
  endRow(): SectionBuilder {
    return this.parent;
  }

  /**
   * Get a control by name
   */
  get<T extends AnyControl = AnyControl>(name: string): T {
    const control = this.controls.get(name);
    if (!control) {
      throw new Error(`Control "${name}" not found in row "${this.name}"`);
    }
    return control as T;
  }

  /**
   * Check if a control exists
   */
  has(name: string): boolean {
    return this.controls.has(name);
  }
}

/**
 * Section builder for grouping controls with a label
 */
export class SectionBuilder {
  readonly element: p5.Element;
  private controls = new Map<string, AnyControl>();
  private parent: ControlsBuilder;

  constructor(private p: p5, readonly name: string, parent: ControlsBuilder) {
    this.parent = parent;
    this.element = p.createDiv();
    this.element.class("sketch-controls__section");

    const labelDiv = p.createDiv(name);
    labelDiv.class("sketch-controls__label");
    labelDiv.parent(this.element);
  }

  /**
   * Add a row for horizontal grouping
   */
  row(name: string): RowBuilder {
    const row = new RowBuilder(this.p, name, this);
    row.element.parent(this.element);
    this.controls.set(name, row);
    return row;
  }

  /**
   * Add a button to the section
   */
  button(label: string, onClick: () => void): this {
    const button = this.p.createButton(label);
    button.mouseClicked(onClick);
    button.parent(this.element);
    this.controls.set(label, new ButtonControl(label, button, onClick));
    return this;
  }

  /**
   * Add a select dropdown to the section
   */
  select(name: string, options: string[], onChange: (value: string) => void): this {
    const select = this.p.createSelect() as p5.Element & { option: (opt: string) => void };
    options.forEach(opt => select.option(opt));
    select.elt.addEventListener("change", () => onChange(select.value() as string));
    select.parent(this.element);
    this.controls.set(name, new SelectControl(name, select, onChange));
    return this;
  }

  /**
   * Add a number input to the section
   */
  numberInput(name: string, defaultValue: number, onSubmit?: (value: number) => void): this {
    if (onSubmit) {
      const group = this.p.createDiv();
      group.class("sketch-controls__input-group");
      group.parent(this.element);

      const input = this.p.createInput(String(defaultValue), "number");
      input.attribute("placeholder", name);
      input.parent(group);

      const submitButton = this.p.createButton("Set");
      submitButton.mouseClicked(() => onSubmit(Number(input.value())));
      submitButton.parent(group);

      this.controls.set(name, new NumberInputControl(name, input, onSubmit, submitButton));
    } else {
      const input = this.p.createInput(String(defaultValue), "number");
      input.attribute("placeholder", name);
      input.parent(this.element);
      this.controls.set(name, new NumberInputControl(name, input));
    }
    return this;
  }

  /**
   * Add a text input to the section
   */
  textInput(name: string, defaultValue: string, onInput?: (value: string) => void): this {
    const input = this.p.createInput(defaultValue, "text");
    input.attribute("placeholder", name);
    if (onInput) {
      (input.elt as HTMLInputElement).addEventListener("input", () => onInput(input.value() as string));
    }
    input.parent(this.element);
    this.controls.set(name, new TextInputControl(name, input, onInput));
    return this;
  }

  /**
   * Add a stat display to the section
   */
  stat(name: string, initialText: string = ""): this {
    const stat = this.p.createDiv(initialText);
    stat.class("sketch-controls__stat");
    stat.parent(this.element);
    this.controls.set(name, new StatControl(name, stat));
    return this;
  }

  /**
   * Add a highlight display to the section
   */
  highlight(name: string, initialText: string = ""): this {
    const highlight = this.p.createDiv(initialText);
    highlight.class("sketch-controls__highlight");
    highlight.parent(this.element);
    this.controls.set(name, new HighlightControl(name, highlight));
    return this;
  }

  /**
   * Add a checkbox to the section
   */
  checkbox(name: string, labelText: string, defaultChecked: boolean, onChange: (checked: boolean) => void): this {
    // Create checkbox using DOM directly (not p5) for better control over structure
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = defaultChecked;
    input.addEventListener("change", () => onChange(input.checked));

    const span = document.createElement("span");
    span.textContent = labelText;

    label.appendChild(input);
    label.appendChild(span);
    this.element.elt.appendChild(label);

    // Wrap in a minimal p5.Element-like object for CheckboxControl
    const wrapper = { elt: input } as p5.Element;
    this.controls.set(name, new CheckboxControl(name, wrapper, onChange));
    return this;
  }

  /**
   * Add a slider to the section
   */
  slider(
    label: string,
    min: number,
    max: number,
    defaultValue: number,
    step: number,
    onChange: (value: number) => void
  ): this {
    const container = this.p.createDiv();
    container.class("sketch-controls__slider-container");
    container.parent(this.element);

    const labelEl = this.p.createSpan(label);
    labelEl.class("sketch-controls__slider-label");
    labelEl.parent(container);

    const slider = this.p.createSlider(min, max, defaultValue, step);
    (slider.elt as HTMLInputElement).addEventListener("input", () => onChange(Number(slider.value())));
    slider.parent(container);
    this.controls.set(label, new SliderControl(label, slider, onChange));
    return this;
  }

  /**
   * Add a radio group to the section
   * @deprecated Use a row with individual radio() controls instead for better flexibility
   */
  radioGroup(name: string, options: string[], defaultValue: string, onChange: (value: string) => void): this {
    const groupId = `radio-${name}-${Date.now()}`;
    const container = this.p.createDiv();
    container.class("sketch-controls__radio-group-vertical");
    container.parent(this.element);

    const radioControl = new RadioGroupControl(name, container, onChange);

    options.forEach(option => {
      const label = document.createElement("label");
      label.dataset.radioGroup = groupId;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = groupId;
      input.value = option;
      input.checked = option === defaultValue;
      input.addEventListener("change", () => {
        if (input.checked) onChange(option);
      });

      const span = document.createElement("span");
      span.textContent = option;

      label.appendChild(input);
      label.appendChild(span);
      container.elt.appendChild(label);

      // Add hover handlers for group indication
      this.addRadioGroupHoverHandlers(label, groupId);

      radioControl.registerRadio(option, input);
    });

    this.controls.set(name, radioControl);
    return this;
  }

  /**
   * Add hover handlers to a radio label to highlight sibling radios in the same group
   */
  private addRadioGroupHoverHandlers(label: HTMLLabelElement, groupId: string): void {
    label.addEventListener("mouseenter", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        if (sibling !== label) {
          sibling.classList.add("radio-group-sibling-hover");
        }
      });
    });

    label.addEventListener("mouseleave", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        sibling.classList.remove("radio-group-sibling-hover");
      });
    });
  }

  /**
   * Add a custom element to the section
   */
  custom(name: string, element: p5.Element): this {
    element.parent(this.element);
    this.controls.set(name, new StatControl(name, element)); // Use StatControl as generic wrapper
    return this;
  }

  /**
   * End the section and return to the parent controls builder
   */
  endSection(): ControlsBuilder {
    return this.parent;
  }

  /**
   * Get a control by name
   */
  get<T extends AnyControl = AnyControl>(name: string): T {
    const control = this.controls.get(name);
    if (!control) {
      throw new Error(`Control "${name}" not found in section "${this.name}"`);
    }
    return control as T;
  }

  /**
   * Check if a control exists
   */
  has(name: string): boolean {
    return this.controls.has(name);
  }
}

/**
 * Main controls builder with fluent API
 */
export class ControlsBuilder {
  private panel: p5.Element;
  private sections = new Map<string, SectionBuilder>();

  constructor(private p: p5) {
    this.panel = p.createDiv();
    this.panel.class("sketch-controls");
  }

  /**
   * Add a section with a label
   */
  section(label: string): SectionBuilder {
    const section = new SectionBuilder(this.p, label, this);
    section.element.parent(this.panel);
    this.sections.set(label, section);
    return section;
  }

  /**
   * Add a divider
   */
  divider(): this {
    const divider = this.p.createDiv();
    divider.class("sketch-controls__divider");
    divider.parent(this.panel);
    return this;
  }

  /**
   * Get a section by name
   */
  get<T extends SectionBuilder = SectionBuilder>(name: string): T {
    const section = this.sections.get(name);
    if (!section) {
      throw new Error(`Section "${name}" not found`);
    }
    return section as T;
  }

  /**
   * Check if a section exists
   */
  has(name: string): boolean {
    return this.sections.has(name);
  }

  /**
   * Get the panel element
   */
  getPanel(): p5.Element {
    return this.panel;
  }
}

export class P5MouseEvents extends EventEmitter<{
  clicked: [event: MouseEvent];
  dragged: [event: MouseEvent];
  moved: [event: MouseEvent];
  pressed: [event: MouseEvent];
  released: [event: MouseEvent];
  wheel: [event: WheelEvent];
}> {
  constructor(private sketch: p5) {
    super();
    sketch.mouseClicked = (event: MouseEvent) => this.emit("clicked", event);
    sketch.mouseDragged = (event: MouseEvent) => this.emit("dragged", event);
    sketch.mouseMoved = (event: MouseEvent) => this.emit("moved", event);
    sketch.mousePressed = (event: MouseEvent) => this.emit("pressed", event);
    sketch.mouseReleased = (event: MouseEvent) => this.emit("released", event);
    sketch.mouseWheel = (event: WheelEvent) => this.emit("wheel", event);
  }

  get button() {
    return this.sketch.mouseButton;
  }

  get x() {
    return this.sketch.mouseX;
  }
  get y() {
    return this.sketch.mouseY;
  }
  get winX() {
    return this.sketch.winMouseX;
  }
  get winY() {
    return this.sketch.winMouseY;
  }
  get pwinX() {
    return this.sketch.pwinMouseX;
  }
  get pwinY() {
    return this.sketch.pwinMouseY;
  }
}

/**
 * Global controls that persist across sketch changes
 */
export class GlobalControls {
  private static instance: GlobalControls | null = null;
  private panel: HTMLElement | null = null;
  private _isStopped = false;
  private targetFPS = 60;
  private playbackButtons: Map<string, HTMLLabelElement> = new Map();
  private stepButton: HTMLButtonElement | null = null;
  private fpsInput: HTMLInputElement | null = null;
  private fpsDisplay: HTMLElement | null = null;
  private currentP5Instance: p5 | null = null;

  private constructor() {
    this.createUI();
  }

  static getInstance(): GlobalControls {
    if (!GlobalControls.instance) {
      GlobalControls.instance = new GlobalControls();
    }
    return GlobalControls.instance;
  }

  private createUI(): void {
    const container = document.getElementById("global-controls-container");
    if (!container) {
      console.error("Global controls container not found");
      return;
    }

    // Wrap in sketch-controls for styling, then global-controls for overrides
    // Use sketch-controls--global to distinguish from sketch-specific controls
    const wrapper = document.createElement("div");
    wrapper.className = "sketch-controls sketch-controls--global";

    this.panel = document.createElement("div");
    this.panel.className = "global-controls";

    // Playback controls row: Reset | Stop | Step | Play
    const playbackRow = document.createElement("div");
    playbackRow.className = "sketch-controls__row";

    // Reset button (not part of radio group - it's an action)
    const resetButton = document.createElement("button");
    resetButton.className = "sketch-controls__button";
    resetButton.textContent = "Reset";
    resetButton.addEventListener("click", () => this.resetSketch());
    playbackRow.appendChild(resetButton);

    // Stop radio button
    this.createPlaybackRadio(playbackRow, "stop", "Stop", false, () => this.stop());

    // Step button (only works when stopped)
    this.stepButton = document.createElement("button");
    this.stepButton.className = "sketch-controls__button";
    this.stepButton.textContent = "Step";
    this.stepButton.disabled = true;
    this.stepButton.addEventListener("click", () => this.step());
    playbackRow.appendChild(this.stepButton);

    // Play radio button
    this.createPlaybackRadio(playbackRow, "play", "Play", true, () => this.play());

    this.panel.appendChild(playbackRow);

    // FPS control row
    const fpsRow = document.createElement("div");
    fpsRow.className = "sketch-controls__row";

    const fpsLabelSpan = document.createElement("span");
    fpsLabelSpan.className = "sketch-controls__slider-label";
    fpsLabelSpan.textContent = "Target FPS";
    fpsRow.appendChild(fpsLabelSpan);

    this.fpsInput = document.createElement("input");
    this.fpsInput.type = "number";
    this.fpsInput.min = "1";
    this.fpsInput.max = "1000";
    this.fpsInput.value = String(this.targetFPS);
    this.fpsInput.className = "sketch-controls__input";
    this.fpsInput.addEventListener("input", e => {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (!isNaN(value) && value > 0 && value <= 120) {
        this.setFPS(value);
      }
    });
    fpsRow.appendChild(this.fpsInput);

    this.panel.appendChild(fpsRow);

    // FPS display (stat)
    this.fpsDisplay = document.createElement("div");
    this.fpsDisplay.className = "sketch-controls__stat";
    this.fpsDisplay.innerHTML = "Current: --";
    this.panel.appendChild(this.fpsDisplay);

    wrapper.appendChild(this.panel);
    container.appendChild(wrapper);

    // Update FPS display every 500ms
    setInterval(() => this.updateFPSDisplay(), 500);
  }

  /**
   * Create a radio button for the playback controls
   */
  private createPlaybackRadio(
    container: HTMLElement,
    value: string,
    labelText: string,
    defaultChecked: boolean,
    onChange: () => void
  ): void {
    const groupId = "global-playback";

    const label = document.createElement("label");
    label.dataset.radioGroup = groupId;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupId;
    input.value = value;
    input.checked = defaultChecked;
    input.addEventListener("change", () => {
      if (input.checked) onChange();
    });

    const span = document.createElement("span");
    span.textContent = labelText;

    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);

    // Store reference for programmatic access
    this.playbackButtons.set(value, label);

    // Add hover handlers for group indication
    label.addEventListener("mouseenter", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        if (sibling !== label) {
          sibling.classList.add("radio-group-sibling-hover");
        }
      });
    });

    label.addEventListener("mouseleave", () => {
      const siblings = document.querySelectorAll(`label[data-radio-group="${groupId}"]`);
      siblings.forEach(sibling => {
        sibling.classList.remove("radio-group-sibling-hover");
      });
    });
  }

  /**
   * Wire the global controls into a p5 instance
   */
  wire(p5Instance: p5): void {
    this.currentP5Instance = p5Instance;

    // Apply current settings
    if (this.targetFPS) {
      p5Instance.frameRate(this.targetFPS);
    }

    // If stopped, stop the new instance immediately
    if (this._isStopped) {
      p5Instance.noLoop();
    }
  }

  /**
   * Stop the sketch (pause)
   */
  private stop(): void {
    if (!this.currentP5Instance) return;

    this._isStopped = true;
    this.currentP5Instance.noLoop();

    if (this.stepButton) {
      this.stepButton.disabled = false;
    }
  }

  /**
   * Step one frame forward (only when stopped)
   */
  private step(): void {
    if (!this.currentP5Instance || !this._isStopped) return;

    this.currentP5Instance.redraw();
  }

  /**
   * Play the sketch (resume)
   */
  private play(): void {
    if (!this.currentP5Instance) return;

    this._isStopped = false;
    this.currentP5Instance.loop();

    if (this.stepButton) {
      this.stepButton.disabled = true;
    }
  }

  /**
   * Reset the sketch by calling setup() again
   */
  private resetSketch(): void {
    if (!this.currentP5Instance) return;

    // Call setup again if it exists
    if (typeof this.currentP5Instance.setup === "function") {
      this.currentP5Instance.setup();
    }
  }

  /**
   * Set target FPS
   */
  private setFPS(fps: number): void {
    this.targetFPS = fps;
    if (this.currentP5Instance) {
      this.currentP5Instance.frameRate(fps);
    }
  }

  /**
   * Update FPS display
   */
  private updateFPSDisplay(): void {
    if (this.fpsDisplay && this.currentP5Instance) {
      const currentFPS = this.currentP5Instance.frameRate();
      this.fpsDisplay.innerHTML = `Current: ${currentFPS.toFixed(1)} FPS`;
    }
  }

  /**
   * Get current stop state
   */
  getStopState(): boolean {
    return this._isStopped;
  }

  /**
   * Get current target FPS
   */
  getTargetFPS(): number {
    return this.targetFPS;
  }
}
