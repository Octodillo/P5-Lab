// =============================================================================
// Descriptor types
// =============================================================================

export type ControlValue = unknown;

export type RadioDesc<N extends string = string, V = string> = {
  readonly type: "radio";
  readonly name: N;
  readonly value: V;
  readonly label: string;
  readonly selected: boolean;
};

export type CheckboxDesc<N extends string = string> = {
  readonly type: "checkbox";
  readonly name: N;
  readonly label: string;
  readonly checked: boolean;
};

export type SliderDesc<N extends string = string> = {
  readonly type: "slider";
  readonly name: N;
  readonly label?: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
  readonly step: number;
};

export type SelectDesc<N extends string = string, V = unknown> = {
  readonly type: "select";
  readonly name: N;
  readonly label?: string;
  readonly options: readonly OptionDesc<V>[];
  readonly selected: V;
};

export type OptionDesc<V = string> = {
  readonly type: "option";
  readonly value: V;
  readonly label: string;
};

export type StatDesc<N extends string = string> = {
  readonly type: "stat";
  readonly name: N;
  readonly label?: string;
  readonly value: string;
};

export type ButtonDesc<N extends string = string> = {
  readonly type: "button";
  readonly name: N;
  readonly label: string;
};

export type TextInputDesc<N extends string = string> = {
  readonly type: "textInput";
  readonly name: N;
  readonly label?: string;
  readonly value: string;
  readonly placeholder?: string;
};

export type NumberInputDesc<N extends string = string> = {
  readonly type: "numberInput";
  readonly name: N;
  readonly label?: string;
  readonly value: number;
  readonly placeholder?: string;
};

export type RowDesc<I extends readonly InputDesc[] = readonly InputDesc[]> = {
  readonly type: "row";
  readonly inputs: I;
};
export type DividerDesc = { readonly type: "divider" };
export type TabsDesc<
  P extends Record<string, readonly (RowDesc | InputDesc | DividerDesc)[]> = Record<
    string,
    readonly (RowDesc | InputDesc | DividerDesc)[]
  >,
> = {
  readonly type: "tabs";
  readonly controlName: string;
  readonly panels: P;
};

export type SectionDesc<
  C extends readonly (RowDesc | InputDesc | TabsDesc | DividerDesc)[] = readonly (
    | RowDesc
    | InputDesc
    | TabsDesc
    | DividerDesc
  )[],
> = {
  readonly type: "section";
  readonly label: string;
  readonly controls: C;
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

export type ControlDesc = SectionDesc | RowDesc | InputDesc | DividerDesc | TabsDesc;

// =============================================================================
// Type-level value extraction from descriptor arrays
// =============================================================================

/** The TS value type for a given input descriptor */
type ValueOf<D extends InputDesc> = D extends SliderDesc | NumberInputDesc ? number
  : D extends CheckboxDesc ? boolean
  : D extends ButtonDesc ? true
  : D extends RadioDesc<string, infer V> ? V
  : D extends SelectDesc<string, infer V> ? V
  : string;

/** Recursively collect all InputDescs from a descriptor tree */
type FlatInputs<T> = T extends InputDesc ? T
  : T extends RowDesc ? FlatInputs<T["inputs"][number]>
  : T extends SectionDesc ? FlatInputs<T["controls"][number]>
  : T extends TabsDesc ? FlatInputs<T["panels"][keyof T["panels"]][number]>
  : never;

/** Map from control name → value type for a schema */
export type SchemaValues<S extends readonly ControlDesc[]> = {
  [D in FlatInputs<S[number]> as D["name"]]: ValueOf<D>;
};

// =============================================================================
// Factory functions
// =============================================================================

export const section = <const C extends readonly (RowDesc | InputDesc | TabsDesc | DividerDesc)[]>(
  label: string,
  controls: C,
): SectionDesc<C> => ({ type: "section", label, controls }) as SectionDesc<C>;

export const row = <const I extends readonly InputDesc[]>(inputs: I): RowDesc<I> =>
  ({ type: "row", inputs }) as RowDesc<I>;

export const radio = <N extends string, V extends string | number>(
  name: N,
  value: V,
  label: string,
  selected = false,
): RadioDesc<N, V> => ({ type: "radio", name, value, label, selected }) as const;

export const checkbox = <N extends string>(
  name: N,
  label: string,
  checked = false,
): CheckboxDesc<N> => ({ type: "checkbox", name, label, checked }) as const;

export const slider = <N extends string>(
  name: N,
  min: number,
  max: number,
  value: number,
  step = 1,
  label?: string,
): SliderDesc<N> => ({ type: "slider", name, label, min, max, value, step }) as const;

export const select = <N extends string, const V>(
  name: N,
  options: readonly OptionDesc<V>[],
  selected?: V,
  label?: string,
): SelectDesc<N, V> =>
  ({
    type: "select",
    name,
    label,
    options,
    selected: selected ?? options[0]?.value,
  }) as SelectDesc<N, V>;

export const option = <const V>(label: string, value: V): OptionDesc<V> => ({
  type: "option",
  value,
  label,
});

export const stat = <N extends string>(name: N, value = "", label?: string): StatDesc<N> => ({
  type: "stat",
  name,
  label,
  value,
});

export const button = <N extends string>(name: N, label?: string): ButtonDesc<N> => ({
  type: "button",
  name,
  label: label ?? name,
});

export const textInput = <N extends string>(
  name: N,
  value = "",
  placeholder?: string,
  label?: string,
): TextInputDesc<N> => ({ type: "textInput", name, label, value, placeholder });

export const numberInput = <N extends string>(
  name: N,
  value = 0,
  placeholder?: string,
  label?: string,
): NumberInputDesc<N> => ({ type: "numberInput", name, label, value, placeholder });

export const divider = (): DividerDesc => ({ type: "divider" });

export const tabs = <
  const P extends Record<string, readonly (RowDesc | InputDesc | DividerDesc)[]>,
>(
  controlName: string,
  panels: P,
): TabsDesc<P> => ({ type: "tabs", controlName, panels }) as TabsDesc<P>;

// =============================================================================
// Controls — observable state + DOM rendering
// =============================================================================

type Observer = (value: ControlValue) => void;
type LiveEntry = {
  el: HTMLElement;
  get(): ControlValue;
  set(v: ControlValue): void;
  desc: InputDesc;
};

/** Allows `controls.name` as shorthand for `controls.get(name)` and destructuring. */
export interface Controls<S extends readonly ControlDesc[] = readonly ControlDesc[]> {
  readonly [key: string]: unknown;
}

export class Controls<S extends readonly ControlDesc[] = readonly ControlDesc[]> {
  private state = new Map<string, ControlValue>();
  private observers = new Map<string, Set<Observer>>();
  private live = new Map<string, LiveEntry>();
  readonly panel: HTMLElement;

  /** Type-safe accessor for control values. Destructure freely: `const { x, y } = controls.values` */
  readonly values: SchemaValues<S>;

  constructor(panel: HTMLElement) {
    this.panel = panel;
    this.values = new Proxy({} as SchemaValues<S>, {
      get: (_target, prop) => {
        if (typeof prop === "string") return this.state.get(prop);
        return undefined;
      },
    });
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }
        return target.tryGet(prop);
      },
    }) as Controls<S>;
  }

  // --- public API ----------------------------------------------------------

  get<K extends string & keyof SchemaValues<S>>(name: K): SchemaValues<S>[K] {
    const v = this.state.get(name);
    if (v === undefined) throw new Error(`Control "${name}" not found`);
    return v as SchemaValues<S>[K];
  }

  tryGet<K extends string & keyof SchemaValues<S>>(name: K): SchemaValues<S>[K] | undefined {
    return this.state.get(name) as SchemaValues<S>[K] | undefined;
  }

  about<D extends InputDesc = InputDesc>(name: string & keyof SchemaValues<S>): D | undefined {
    return this.live.get(name)?.desc as D | undefined;
  }

  set<K extends string & keyof SchemaValues<S>>(name: K, value: SchemaValues<S>[K]): this {
    this.state.set(name, value);
    this.live.get(name)?.set(value);
    this.notify(name, value);
    return this;
  }

  subscribe<K extends string & keyof SchemaValues<S>>(
    name: K,
    cb: (value: SchemaValues<S>[K]) => void,
    now = true,
  ): () => void {
    if (!this.observers.has(name)) this.observers.set(name, new Set());
    const wrapped = cb as Observer;
    if (now) {
      // fire immediately with current value
      const cur = this.state.get(name);
      if (cur !== undefined) wrapped(cur);
    }
    this.observers.get(name)!.add(wrapped);
    return () => this.observers.get(name)?.delete(wrapped);
  }

  has(name: string): boolean {
    return this.state.has(name);
  }

  names(): string[] {
    return [...this.state.keys()];
  }

  /** Build DOM from descriptors into the panel */
  render(schema: readonly ControlDesc[]): this {
    this.state.clear();
    this.observers.clear();
    this.live.clear();
    this.panel.innerHTML = "";
    const wrap = el("div", "sketch-controls");
    this.panel.appendChild(wrap);
    for (const d of schema) this.buildNode(d, wrap);
    return this;
  }

  // --- private -------------------------------------------------------------

  private notify(name: string, value: ControlValue) {
    this.observers.get(name)?.forEach((cb) => cb(value));
  }

  private register(name: string, value: ControlValue, entry: LiveEntry) {
    this.state.set(name, value);
    this.live.set(name, entry);
  }

  private fromDOM(name: string, value: ControlValue) {
    this.state.set(name, value);
    this.notify(name, value);
  }

  // --- DOM builders --------------------------------------------------------

  private buildNode(desc: ControlDesc, parent: HTMLElement) {
    const builders: Record<string, () => void> = {
      section: () => this.buildSection(desc as SectionDesc, parent),
      row: () => this.buildRow(desc as RowDesc, parent),
      divider: () => parent.appendChild(el("div", "sketch-controls__divider")),
      tabs: () => this.buildTabs(desc as TabsDesc, parent),
      radio: () => this.buildRadio(desc as RadioDesc, parent),
      checkbox: () => this.buildCheckbox(desc as CheckboxDesc, parent),
      slider: () => this.buildSlider(desc as SliderDesc, parent),
      select: () => this.buildSelect(desc as SelectDesc, parent),
      stat: () => this.buildStat(desc as StatDesc, parent),
      button: () => this.buildButton(desc as ButtonDesc, parent),
      textInput: () => this.buildTextInput(desc as TextInputDesc, parent),
      numberInput: () => this.buildNumberInput(desc as NumberInputDesc, parent),
    };
    builders[desc.type]();
  }

  private buildSection(desc: SectionDesc, parent: HTMLElement) {
    const sec = el("div", "sketch-controls__section");
    const lbl = el("div", "sketch-controls__label");
    lbl.textContent = desc.label;
    sec.appendChild(lbl);
    for (const child of desc.controls) this.buildNode(child, sec);
    parent.appendChild(sec);
  }

  private buildRow(desc: RowDesc, parent: HTMLElement) {
    const r = el("div", "sketch-controls__row");
    for (const input of desc.inputs) this.buildNode(input, r);
    parent.appendChild(r);
  }

  private buildRadio(desc: RadioDesc, parent: HTMLElement) {
    const groupId = `radio-${desc.name}`;
    const label = document.createElement("label");
    label.dataset.radioGroup = groupId;

    const input = inputEl("radio");
    input.name = groupId;
    input.value = String(desc.value);
    input.checked = desc.selected;
    input.addEventListener("change", () => {
      if (input.checked) this.fromDOM(desc.name, desc.value);
    });

    label.append(input, span(desc.label));
    parent.appendChild(label);
    addRadioHover(label, groupId);

    if (desc.selected) {
      this.register(desc.name, desc.value, {
        el: label,
        desc: desc as InputDesc,
        get: () => desc.value,
        set: (v) => {
          input.checked = v === desc.value;
        },
      });
    }
  }

  private buildCheckbox(desc: CheckboxDesc, parent: HTMLElement) {
    const label = document.createElement("label");
    const input = inputEl("checkbox");
    input.checked = desc.checked;
    input.addEventListener("change", () => this.fromDOM(desc.name, input.checked));
    label.append(input, span(desc.label));
    parent.appendChild(label);
    this.register(desc.name, desc.checked, {
      el: label,
      desc,
      get: () => input.checked,
      set: (v) => {
        input.checked = Boolean(v);
      },
    });
  }

  private buildSlider(desc: SliderDesc, parent: HTMLElement) {
    const container = el("div", "sketch-controls__slider-container");
    const lbl = el("span", "sketch-controls__slider-label");
    lbl.textContent = desc.label ?? desc.name;
    const input = inputEl("range");
    Object.assign(input, {
      min: String(desc.min),
      max: String(desc.max),
      step: String(desc.step),
      value: String(desc.value),
    });
    const val = el("span", "sketch-controls__slider-value");
    val.textContent = String(desc.value);
    input.addEventListener("input", () => {
      const n = Number(input.value);
      val.textContent = String(n);
      this.fromDOM(desc.name, n);
    });
    container.append(lbl, input, val);
    parent.appendChild(container);
    this.register(desc.name, desc.value, {
      el: container,
      desc,
      get: () => Number(input.value),
      set: (v) => {
        input.value = String(v);
        val.textContent = String(v);
      },
    });
  }

  private buildSelect(desc: SelectDesc, parent: HTMLElement) {
    const selectEl = document.createElement("select");
    const selectedIdx = desc.options.findIndex((o) => o.value === desc.selected);
    for (let i = 0; i < desc.options.length; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = desc.options[i].label;
      if (i === selectedIdx) o.selected = true;
      selectEl.appendChild(o);
    }
    selectEl.addEventListener("change", () => {
      this.fromDOM(desc.name, desc.options[Number(selectEl.value)].value);
    });

    const wrapper = desc.label ? labelWrap(desc.label, selectEl) : selectEl;
    parent.appendChild(wrapper);
    this.register(desc.name, desc.selected, {
      el: wrapper,
      desc: desc as InputDesc,
      get: () => desc.options[Number(selectEl.value)].value,
      set: (v) => {
        const idx = desc.options.findIndex((o) => o.value === v);
        if (idx >= 0) selectEl.value = String(idx);
      },
    });
  }

  private buildStat(desc: StatDesc, parent: HTMLElement) {
    const container = el("div", "sketch-controls__stat");
    if (desc.label) {
      const lbl = el("span", "sketch-controls__stat-label");
      lbl.textContent = desc.label;
      container.appendChild(lbl);
    }
    const valEl = el("span", "sketch-controls__stat-value");
    valEl.textContent = desc.value;
    container.appendChild(valEl);
    parent.appendChild(container);
    this.register(desc.name, desc.value, {
      el: valEl,
      desc,
      get: () => valEl.textContent ?? "",
      set: (v) => {
        valEl.textContent = String(v);
      },
    });
  }

  private buildButton(desc: ButtonDesc, parent: HTMLElement) {
    const btn = document.createElement("button");
    btn.textContent = desc.label;
    btn.addEventListener("click", () => this.fromDOM(desc.name, true));
    parent.appendChild(btn);
    this.register(desc.name, undefined, {
      el: btn,
      desc,
      get: () => undefined,
      set: () => {},
    });
  }

  private buildTextInput(desc: TextInputDesc, parent: HTMLElement) {
    const input = inputEl("text");
    input.value = desc.value;
    if (desc.placeholder) input.placeholder = desc.placeholder;
    input.addEventListener("input", () => this.fromDOM(desc.name, input.value));
    const wrapper = desc.label ? labelWrap(desc.label, input) : input;
    parent.appendChild(wrapper);
    this.register(desc.name, desc.value, {
      el: wrapper,
      desc,
      get: () => input.value,
      set: (v) => {
        input.value = String(v);
      },
    });
  }

  private buildNumberInput(desc: NumberInputDesc, parent: HTMLElement) {
    const input = inputEl("number");
    input.value = String(desc.value);
    if (desc.placeholder) input.placeholder = desc.placeholder;
    input.addEventListener("input", () => this.fromDOM(desc.name, Number(input.value)));
    const wrapper = desc.label ? labelWrap(desc.label, input) : input;
    parent.appendChild(wrapper);
    this.register(desc.name, desc.value, {
      el: wrapper,
      desc,
      get: () => Number(input.value),
      set: (v) => {
        input.value = String(v);
      },
    });
  }

  private buildTabs(desc: TabsDesc, parent: HTMLElement) {
    const container = el("div", "sketch-controls__tabs");
    const panels = new Map<string, HTMLElement>();

    for (const [key, children] of Object.entries(desc.panels)) {
      const panel = el("div", "sketch-controls__tab-panel");
      panel.dataset.tabKey = key;
      for (const child of children) this.buildNode(child, panel);
      container.appendChild(panel);
      panels.set(key, panel);
    }
    parent.appendChild(container);

    const show = (v: ControlValue) => {
      const active = String(v);
      for (const [k, p] of panels) p.style.display = k === active ? "" : "none";
    };

    const key = desc.controlName as string & keyof SchemaValues<S>;
    const cur = this.tryGet(key);
    show(cur ?? Object.keys(desc.panels)[0] ?? "");
    this.subscribe(key, show as any);
  }
}

// =============================================================================
// Tiny DOM helpers
// =============================================================================

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function span(text: string): HTMLSpanElement {
  const s = document.createElement("span");
  s.textContent = text;
  return s;
}

function inputEl(type: string): HTMLInputElement {
  const i = document.createElement("input");
  i.type = type;
  return i;
}

function labelWrap(text: string, child: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.append(span(text), child);
  return label;
}

function addRadioHover(label: HTMLElement, groupId: string) {
  label.addEventListener("mouseenter", () => {
    document.querySelectorAll(`label[data-radio-group="${groupId}"]`).forEach((s) => {
      if (s !== label) s.classList.add("radio-group-hover");
    });
  });
  label.addEventListener("mouseleave", () => {
    document.querySelectorAll(`label[data-radio-group="${groupId}"]`).forEach((s) => {
      s.classList.remove("radio-group-hover");
    });
  });
}
