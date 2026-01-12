import p5 from "p5";
import { P5MouseEvents, ControlsBuilder } from "../common.ts";
import type { Rule } from "./rules.ts";
import * as Rules from "./rules.ts";
import { Stamp, Glider, SmallExploder, LightweightSpaceship, Tumbler, GosperGliderGun, LaserGun } from "./stamps.ts";

type BrushType = "draw" | "erase" | "stamp";

export class Cell {
  constructor(readonly life: LifeModel, readonly position: p5.Vector, readonly rule: Rule) {
    this.decayRate = rule.decay !== undefined ? 1 / (rule.decay + 1) : 1;
  }

  private static readonly PIXEL_THRESHOLD = 0.5; // Switch to pixel rendering below this scale

  draw() {
    const color = this.life.config.sketch.color(this.rule.color.hex);
    let alpha = this.decay;
    if (this.rule.color.invert) alpha = 1 - alpha;
    alpha += (1 - alpha) * 0.2;
    alpha = Math.min(alpha, 1);
    if (this.rule.color.nudge) alpha += (Math.random() - 0.5) * this.rule.color.nudge;
    color.setAlpha(alpha);

    const scale = this.life.config.scale;
    const x = this.position.x * scale;
    const y = this.position.y * scale;

    if (scale < Cell.PIXEL_THRESHOLD) {
      // Use pixel rendering for small scales
      this.life.config.sketch.stroke(color);
      this.life.config.sketch.strokeWeight(1);
      this.life.config.sketch.point(x, y);
    } else {
      // Use square rendering for larger scales
      this.life.config.sketch.noStroke();
      this.life.config.sketch.fill(color);
      this.life.config.sketch.square(x, y, scale);
    }
  }

  update() {
    if (this.decaying) this.decay -= this.decayRate;
    if (this.decay > 0.0001) return;
    this.life.unset(this.position);
  }

  private decay = 1;
  private decaying = false;
  private readonly decayRate;
  die(instant = false) {
    if (instant || this.rule.decay === 0) this.life.unset(this.position);
    this.decaying = true;
    this.life.splash(this.position);
  }
  isDead() {
    return this.decaying;
  }
  getDecay() {
    return this.decay;
  }
}

export class LifeModel {
  private cells: Cell[][] = [];
  private volatile = new Map<number, Set<number>>(); // x -> Set<y>
  private mouse: P5MouseEvents;
  private selectedRule: Rule = Rules.GOL;
  private originalRule: Rule = Rules.GOL; // Track original rule for comparison
  private customRules: Rule[] = [];
  private isEditingRule = false;
  private currentRuleName = "";
  private currentRuleBorn = "";
  private currentRuleLive = "";
  private currentRuleColor = "";
  private autoZoom = true;
  private lastDragPos?: p5.Vector;
  private brushType: BrushType = "draw";
  private selectedStamp: Stamp = Glider;
  private readonly availableStamps = [
    { name: "Glider", stamp: Glider },
    { name: "Small Exploder", stamp: SmallExploder },
    { name: "Lightweight Spaceship", stamp: LightweightSpaceship },
    { name: "Tumbler", stamp: Tumbler },
    { name: "Gosper Glider Gun", stamp: GosperGliderGun },
    { name: "Laser Gun", stamp: LaserGun },
  ];

  // Control references
  private cellCountStat?: p5.Element;
  private volatileStat?: p5.Element;
  private hoverInfo?: p5.Element;
  private scaleStat?: p5.Element;
  private centerStat?: p5.Element;
  private ruleSelect?: p5.Element;
  private stampSelect?: p5.Element;
  private ruleNameInput?: p5.Element;
  private ruleBornInput?: p5.Element;
  private ruleLiveInput?: p5.Element;
  private ruleColorInput?: p5.Element;
  private ruleDecayInput?: p5.Element;
  private ruleSaveBtn?: p5.Element;
  private ruleFieldsContainer?: p5.Element;

  constructor(
    public config: {
      readonly sketch: p5;
      center: p5.Vector;
      scale: number;
      grid: boolean | undefined; // undefined is automatic
      colors: {
        grid: {};
      };
    },
    controls?: ControlsBuilder
  ) {
    this.mouse = new P5MouseEvents(config.sketch);
    this.loadCustomRules();
    this.initMouseControl();

    if (controls) {
      this.initControls(controls);
    }

    // Initialize scale and center to fit all cells
    const fit = this.calculateFit();
    if (fit) {
      this.config.scale = fit.scale;
      this.config.center.set(fit.center);
    }
  }

  private initMouseControl() {
    const m = this.mouse;

    m.on("pressed", event => {
      if (!this.isMouseOverCanvas()) return;
      if (event.button !== 0) return; // Only left click

      const pos = this.mouseToGridPos();
      this.handleBrushAction(pos);
      this.lastDragPos = pos;
    });

    m.on("dragged", e => {
      if (!this.isMouseOverCanvas()) return;
      e.preventDefault();

      // Middle mouse button for panning
      if (e.buttons & 4) {
        this.config.center.add(e.movementX, e.movementY);
        return;
      }

      // Only left button for drawing
      if (!(e.buttons & 1)) return;

      const currentPos = this.mouseToGridPos();

      // Draw line from last position to current position
      if (this.lastDragPos && this.brushType !== "stamp") {
        this.drawLine(this.lastDragPos, currentPos, pos => this.handleBrushAction(pos));
      } else {
        this.handleBrushAction(currentPos);
      }
      this.lastDragPos = currentPos;
    });

    m.on("released", () => {
      this.lastDragPos = undefined;
    });

    m.on("wheel", e => {
      if (!this.isMouseOverCanvas()) return;
      const factor = 1 - 0.001 * (e.deltaMode + 1) * (e.deltaX + e.deltaY + e.deltaZ);
      this.config.scale *= factor;
      this.config.center.add(
        this.mouseToScreenPos()
          .sub(this.config.center)
          .mult(1 - factor)
      );

      console.log(this.config.scale, e.deltaX, e.deltaY, e.deltaZ);
    });

    document.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }

  private initControls(controls: ControlsBuilder) {
    const p = this.config.sketch;

    // Simulation controls section
    const simulationSection = controls.addSection(p, "Simulation");

    simulationSection.addButton("▶ Single Step", () => this.update());

    const sprintBtn = simulationSection.addButton(this.sprint ? "⏸ Pause" : "▶▶ Play", () => {
      this.sprint = !this.sprint;
      sprintBtn.html(this.sprint ? "⏸ Pause" : "▶▶ Play");
      if (this.sprint) {
        sprintBtn.addClass("active");
      } else {
        sprintBtn.removeClass("active");
      }
    });

    const autoZoomBtn = simulationSection.addButton(this.autoZoom ? "🔒 Lock Zoom" : "🔓 Auto Zoom", () => {
      this.autoZoom = !this.autoZoom;
      autoZoomBtn.html(this.autoZoom ? "🔒 Lock Zoom" : "🔓 Auto Zoom");
      if (this.autoZoom) {
        autoZoomBtn.addClass("active");
      } else {
        autoZoomBtn.removeClass("active");
      }
    });
    if (this.autoZoom) {
      autoZoomBtn.addClass("active");
    }

    simulationSection.addButton("Clear", () => {
      this.cells = [];
      this.volatile.clear();
    });

    controls.addDivider(p);

    // Drawing controls section
    const drawingSection = controls.addSection(p, "Drawing");

    // Brush type radio buttons
    const brushContainer = p.createDiv();
    brushContainer.class("sketch-controls__radio-group");
    brushContainer.parent(drawingSection["section"]);

    // const brushLabel = p.createElement("span", "Brush Type");
    // brushLabel.class("sketch-controls__label");
    // brushLabel.parent(brushContainer);

    const radioGroup = p.createDiv();
    radioGroup.class("sketch-controls__radios");
    radioGroup.parent(brushContainer);

    // Create radio buttons for each brush type
    const radioName = `brush-type-${Date.now()}`;

    ["draw", "erase", "stamp"].forEach((type, index) => {
      const label = p.createElement("label");
      label.parent(radioGroup);

      const input = p.createElement("input");
      input.attribute("type", "radio");
      input.attribute("name", radioName);
      input.attribute("value", type);
      if (index === 0) input.attribute("checked", "");
      input.parent(label);

      (input.elt as HTMLInputElement).addEventListener("change", () => {
        this.brushType = type as BrushType;
        this.updateBrushUI();
      });

      const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
      p.createElement("span", capitalizedType).parent(label);
    });

    // Stamp selector (shown only for stamp mode)
    this.stampSelect = p.createElement("select") as p5.Element;
    this.stampSelect.parent(drawingSection["section"]);
    this.stampSelect.style("display", "none");

    this.availableStamps.forEach(({ name }) => {
      const opt = p.createElement("option", name);
      opt.attribute("value", name);
      opt.parent(this.stampSelect!);
    });

    (this.stampSelect as any).changed(() => {
      const selectedName = this.stampSelect!.value() as string;
      const found = this.availableStamps.find(s => s.name === selectedName);
      if (found) this.selectedStamp = found.stamp;
    });

    // Rule select (shown for draw mode)
    this.ruleSelect = p.createElement("select") as p5.Element;
    this.ruleSelect.parent(drawingSection["section"]);

    // Add built-in rules
    const builtInGroup = p.createElement("optgroup");
    builtInGroup.attribute("label", "Built-in Rules");
    builtInGroup.parent(this.ruleSelect);

    Object.values(Rules).forEach(rule => {
      const opt = p.createElement("option", rule.name);
      opt.attribute("value", rule.name);
      opt.parent(builtInGroup);
    });

    // Add custom rules group
    const customGroup = p.createElement("optgroup");
    customGroup.attribute("label", "Custom Rules");
    customGroup.parent(this.ruleSelect);

    this.customRules.forEach(rule => {
      const opt = p.createElement("option", rule.name);
      opt.attribute("value", `custom:${rule.name}`);
      opt.parent(customGroup);
    });

    // Add "Create..." option
    const createOpt = p.createElement("option", "Create...");
    createOpt.attribute("value", "create");
    createOpt.parent(customGroup);

    (this.ruleSelect as any).changed(() => {
      const value = this.ruleSelect!.value() as string;

      if (value === "create") {
        this.createNewRule();
      } else if (value.startsWith("custom:")) {
        const ruleName = value.substring(7);
        const customRule = this.customRules.find(r => r.name === ruleName);
        if (customRule) {
          this.selectedRule = customRule;
          this.originalRule = customRule;
          this.isEditingRule = false;
          this.syncRuleFields();
        }
      } else {
        const builtInRule = Object.values(Rules).find(r => r.name === value);
        if (builtInRule) {
          this.selectedRule = builtInRule;
          this.originalRule = builtInRule;
          this.isEditingRule = false;
          this.syncRuleFields();
        }
      }
    });

    // Rule fields container
    this.ruleFieldsContainer = p.createDiv();
    this.ruleFieldsContainer.class("sketch-controls__rule-fields");
    this.ruleFieldsContainer.parent(drawingSection["section"]);

    // Rule name
    const nameGroup = p.createDiv();
    nameGroup.class("sketch-controls__input-group");
    nameGroup.parent(this.ruleFieldsContainer);

    const nameLabel = p.createElement("span", "Name");
    nameLabel.parent(nameGroup);

    this.ruleNameInput = p.createInput(this.selectedRule.name);
    this.ruleNameInput.parent(nameGroup);
    (this.ruleNameInput as any).input(() => this.onRuleFieldChange());

    // Born values
    const bornGroup = p.createDiv();
    bornGroup.class("sketch-controls__input-group");
    bornGroup.parent(this.ruleFieldsContainer);

    const bornLabel = p.createElement("span", "Born");
    bornLabel.parent(bornGroup);

    this.ruleBornInput = p.createInput(this.selectedRule.born.join(","));
    this.ruleBornInput.parent(bornGroup);
    (this.ruleBornInput as any).input(() => this.onRuleFieldChange());

    // Live values
    const liveGroup = p.createDiv();
    liveGroup.class("sketch-controls__input-group");
    liveGroup.parent(this.ruleFieldsContainer);

    const liveLabel = p.createElement("span", "Live");
    liveLabel.parent(liveGroup);

    this.ruleLiveInput = p.createInput(this.selectedRule.live.join(","));
    this.ruleLiveInput.parent(liveGroup);
    (this.ruleLiveInput as any).input(() => this.onRuleFieldChange());

    // Decay
    const decayGroup = p.createDiv();
    decayGroup.class("sketch-controls__input-group");
    decayGroup.parent(this.ruleFieldsContainer);

    const decayLabel = p.createElement("span", "Decay");
    decayLabel.parent(decayGroup);

    // Color
    const colorGroup = p.createDiv();
    colorGroup.class("sketch-controls__input-group");
    colorGroup.parent(this.ruleFieldsContainer);

    const colorLabel = p.createElement("span", "Color");
    colorLabel.parent(colorGroup);

    this.ruleColorInput = p.createInput(this.selectedRule.color.hex);
    this.ruleColorInput.attribute("type", "color");
    this.ruleColorInput.parent(colorGroup);
    (this.ruleColorInput as any).input(() => this.onRuleFieldChange());

    this.ruleDecayInput = p.createInput(String(this.selectedRule.decay ?? 0), "number");
    this.ruleDecayInput.parent(decayGroup);
    (this.ruleDecayInput as any).input(() => this.onRuleFieldChange());

    // Save button
    this.ruleSaveBtn = p.createButton("Save Rule");
    this.ruleSaveBtn.parent(this.ruleFieldsContainer);
    this.ruleSaveBtn.mouseClicked(() => this.saveCustomRule());
    this.updateSaveButtonState();

    this.hoverInfo = drawingSection.addHighlight();

    controls.addDivider(p);

    // Stats section
    const statsSection = controls.addSection(p, "Stats");

    this.cellCountStat = statsSection.addStat();
    this.volatileStat = statsSection.addStat();
    this.scaleStat = statsSection.addStat();
    this.centerStat = statsSection.addStat();
  }

  private handleBrushAction(position: p5.Vector) {
    switch (this.brushType) {
      case "draw":
        this.set(position, this.selectedRule);
        break;
      case "erase":
        this.unset(position);
        break;
      case "stamp":
        this.stamp(this.selectedStamp, position);
        break;
    }
  }

  private updateBrushUI() {
    // Show/hide controls based on brush type
    if (this.ruleSelect) {
      this.ruleSelect.style("display", this.brushType === "draw" ? "block" : "none");
    }
    if (this.ruleFieldsContainer) {
      this.ruleFieldsContainer.style("display", this.brushType === "draw" ? "block" : "none");
    }
    if (this.stampSelect) {
      this.stampSelect.style("display", this.brushType === "stamp" ? "block" : "none");
    }
  }

  allCells = () => Object.values(this.cells).flatMap(col => Object.values(col));

  set(position: p5.Vector, rule: Rule) {
    const { x, y } = position;
    if (!this.cells[x]) this.cells[x] = [];
    this.cells[x][y] = new Cell(this, position, rule);
    this.splash(position);
  }

  get(position: p5.Vector): Cell | undefined {
    const { x, y } = position;
    return this.cells[x]?.[y];
  }

  kill(position: p5.Vector, instant = true) {
    this.get(position)?.die(instant);
  }

  unset(position: p5.Vector) {
    const { x, y } = position;
    delete this.cells[x]?.[y];
    this.splash(position);
  }

  neighborPositions(position: p5.Vector): p5.Vector[] {
    const { x, y } = position;
    return [
      this.config.sketch.createVector(x - 1, y - 1),
      this.config.sketch.createVector(x, y - 1),
      this.config.sketch.createVector(x + 1, y - 1),
      this.config.sketch.createVector(x - 1, y),
      this.config.sketch.createVector(x + 1, y),
      this.config.sketch.createVector(x - 1, y + 1),
      this.config.sketch.createVector(x, y + 1),
      this.config.sketch.createVector(x + 1, y + 1),
    ]; // gotta be a better way
  }

  neighbors(position: p5.Vector): Cell[] {
    return this.neighborPositions(position)
      .map(position => this.get(position))
      .filter(cell => cell !== undefined)
      .filter(cell => !cell.isDead());
  }

  splash(position: p5.Vector) {
    [position, ...this.neighborPositions(position)].forEach(pos => this.makeVolatile(pos));
  }

  makeVolatile(position: p5.Vector) {
    const x = position.x;
    const y = position.y;
    if (!this.volatile.has(x)) {
      this.volatile.set(x, new Set());
    }
    this.volatile.get(x)!.add(y);
  }

  stamp(stamp: Stamp, offset: p5.Vector) {
    for (const pos of stamp.positions) {
      const worldPos = p5.Vector.add(pos, offset);
      this.set(worldPos, stamp.rule);
    }
  }

  update() {
    const births: Cell[] = [];
    const deaths: Cell[] = [];

    this.volatile.forEach((ySet, x) => {
      ySet.forEach(y => {
        const pos = this.config.sketch.createVector(x, y);
        const cell = this.get(pos);
        const neighbors = this.neighbors(pos);
        if (cell) {
          if (!cell.rule.live.includes(neighbors.length)) deaths.push(cell);
        } else {
          const candidates = neighbors
            .filter(neighbor => neighbor.rule.born.includes(neighbors.length))
            .map(candidates => candidates.rule);
          if (candidates.length === 0) return;
          console.log(candidates);
          const rule = candidates[Math.floor(Math.random() * candidates.length)];
          births.push(new Cell(this, pos, rule));
        }
      });
    });

    this.volatile.clear();
    deaths.forEach(cell => cell.die());
    births.forEach(cell => this.set(cell.position, cell.rule));
    this.allCells().forEach(cell => cell.update());

    console.log(births.length, deaths.length);
  }

  public sprint = false;

  draw() {
    if (this.sprint) this.update();

    // Auto-zoom to fit all cells
    if (this.autoZoom) {
      const fit = this.calculateFit();
      if (fit) {
        this.config.scale += (fit.scale - this.config.scale) * 0.1; // Lerp factor 0.1
        this.config.center.lerp(fit.center, 0.1);
      }
    }

    const s = this.config.sketch;
    s.push();

    s.colorMode("hsl", 1); // easiest to think about
    s.background(0);

    // Update stats displays
    this.updateStats();

    s.translate(
      this.config.sketch.width / 2 + this.config.center.x,
      this.config.sketch.height / 2 + this.config.center.y
    );

    // this.drawVolatile(s);

    this.allCells().forEach(cell => cell.draw());

    // Draw stamp preview
    if (this.brushType === "stamp" && this.isMouseOverCanvas()) {
      this.drawStampPreview(s);
    }

    s.pop();
  }

  private drawStampPreview(s: p5) {
    const mousePos = this.mouseToGridPos();
    const color = s.color(this.selectedStamp.rule.color.hex);
    color.setAlpha(0.3); // Low alpha for preview

    this.selectedStamp.positions.forEach(offset => {
      const worldPos = p5.Vector.add(mousePos, offset);
      const x = worldPos.x * this.config.scale;
      const y = worldPos.y * this.config.scale;

      if (this.config.scale < 0.5) {
        s.stroke(color);
        s.strokeWeight(1);
        s.point(x, y);
      } else {
        s.noStroke();
        s.fill(color);
        s.square(x, y, this.config.scale);
      }
    });
  }

  drawVolatile(s: p5) {
    s.fill(0, 1, 1, 0.1);
    s.noStroke();
    this.volatile.forEach((ySet, x) => {
      ySet.forEach(y => {
        s.square(x * this.config.scale, y * this.config.scale, this.config.scale);
      });
    });
  }

  private isMouseOverCanvas(): boolean {
    const s = this.config.sketch;
    return this.mouse.x >= 0 && this.mouse.x <= s.width && this.mouse.y >= 0 && this.mouse.y <= s.height;
  }

  private mouseToGridPos(floor = true): p5.Vector {
    const s = this.config.sketch;
    // Adjust for canvas center translation
    const x = (this.mouse.x - s.width / 2 - this.config.center.x) / this.config.scale;
    const rx = floor ? Math.floor(x) : x;
    const y = (this.mouse.y - s.height / 2 - this.config.center.y) / this.config.scale;
    const ry = floor ? Math.floor(y) : y;
    return s.createVector(rx, ry);
  }

  private mouseToScreenPos(): p5.Vector {
    const s = this.config.sketch;
    // Convert mouse position to screen space (relative to canvas center)
    const mousePos = s.createVector(this.mouse.x, this.mouse.y);
    const canvasCenter = s.createVector(s.width / 2, s.height / 2);
    return p5.Vector.sub(mousePos, canvasCenter);
  }

  private drawLine(from: p5.Vector, to: p5.Vector, action: (pos: p5.Vector) => void) {
    // Bresenham's line algorithm
    const x0 = Math.floor(from.x);
    const y0 = Math.floor(from.y);
    const x1 = Math.floor(to.x);
    const y1 = Math.floor(to.y);

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      action(this.config.sketch.createVector(x, y));

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  private loadCustomRules() {
    try {
      const stored = localStorage.getItem("life-custom-rules");
      if (stored) {
        this.customRules = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load custom rules:", e);
    }
  }

  private saveCustomRules() {
    try {
      localStorage.setItem("life-custom-rules", JSON.stringify(this.customRules));
    } catch (e) {
      console.error("Failed to save custom rules:", e);
    }
  }

  private syncRuleFields() {
    this.ruleNameInput?.value();
    if (this.ruleNameInput) {
      (this.ruleNameInput as any).value(this.selectedRule.name);
    }
    if (this.ruleBornInput) {
      (this.ruleBornInput as any).value(this.selectedRule.born.join(","));
    }
    if (this.ruleLiveInput) {
      (this.ruleLiveInput as any).value(this.selectedRule.live.join(","));
    }
    if (this.ruleColorInput) {
      (this.ruleColorInput as any).value(this.selectedRule.color.hex);
    }
    if (this.ruleDecayInput) {
      (this.ruleDecayInput as any).value(String(this.selectedRule.decay ?? 0));
    }
    this.updateSaveButtonState();
  }

  private onRuleFieldChange() {
    this.isEditingRule = true;

    // Create temporary custom rule
    const _name = (this.ruleNameInput?.value() as string) || this.selectedRule.name;
    const bornStr = (this.ruleBornInput?.value() as string) || "";
    const liveStr = (this.ruleLiveInput?.value() as string) || "";
    const color = (this.ruleColorInput?.value() as string) || this.selectedRule.color.hex;
    const decayStr = (this.ruleDecayInput?.value() as string) || "0";

    const born = bornStr
      .split(",")
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));
    const live = liveStr
      .split(",")
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));
    const decay = parseInt(decayStr);

    this.selectedRule = {
      name: `Custom (${this.originalRule.name})`,
      color: { hex: color },
      born,
      live,
      decay: decay > 0 ? decay : undefined,
    };

    this.updateSaveButtonState();
  }

  private createNewRule() {
    this.isEditingRule = true;

    // Start with GOL as template
    const template = Rules.GOL;
    this.selectedRule = {
      name: "New Rule",
      color: { hex: template.color.hex },
      born: [...template.born],
      live: [...template.live],
    };
    this.originalRule = this.selectedRule;

    this.syncRuleFields();
  }

  private updateSaveButtonState() {
    if (!this.ruleSaveBtn) return;

    // Check if current rule matches original rule
    const isUnchanged =
      this.selectedRule.name === this.originalRule.name &&
      this.selectedRule.color.hex === this.originalRule.color.hex &&
      JSON.stringify(this.selectedRule.born) === JSON.stringify(this.originalRule.born) &&
      JSON.stringify(this.selectedRule.live) === JSON.stringify(this.originalRule.live) &&
      (this.selectedRule.decay ?? 0) === (this.originalRule.decay ?? 0);

    if (isUnchanged) {
      this.ruleSaveBtn.attribute("disabled", "");
    } else {
      this.ruleSaveBtn.removeAttribute("disabled");
    }
  }

  private saveCustomRule() {
    const name = (this.ruleNameInput?.value() as string) || "Unnamed Rule";
    const bornStr = (this.ruleBornInput?.value() as string) || "";
    const liveStr = (this.ruleLiveInput?.value() as string) || "";
    const color = (this.ruleColorInput?.value() as string) || "#0f0";
    const decayStr = (this.ruleDecayInput?.value() as string) || "0";

    const born = bornStr
      .split(",")
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));
    const live = liveStr
      .split(",")
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));
    const decay = parseInt(decayStr);

    const newRule: Rule = {
      name,
      color: { hex: color },
      born,
      live,
      decay: decay > 0 ? decay : undefined,
    };

    // Remove existing rule with same name
    this.customRules = this.customRules.filter(r => r.name !== name);
    this.customRules.push(newRule);
    this.saveCustomRules();

    this.selectedRule = newRule;
    this.originalRule = newRule;
    this.isEditingRule = false;

    // Rebuild the select
    if (this.ruleSelect) {
      this.rebuildRuleSelect();
    }

    this.updateSaveButtonState();
  }

  private rebuildRuleSelect() {
    if (!this.ruleSelect) return;

    const p = this.config.sketch;

    // Clear and rebuild
    (this.ruleSelect.elt as HTMLSelectElement).innerHTML = "";

    // Built-in rules
    const builtInGroup = p.createElement("optgroup");
    builtInGroup.attribute("label", "Built-in Rules");
    builtInGroup.parent(this.ruleSelect);

    Object.values(Rules).forEach(rule => {
      const opt = p.createElement("option", rule.name);
      opt.attribute("value", rule.name);
      opt.parent(builtInGroup);
    });

    // Custom rules
    const customGroup = p.createElement("optgroup");
    customGroup.attribute("label", "Custom Rules");
    customGroup.parent(this.ruleSelect);

    this.customRules.forEach(rule => {
      const opt = p.createElement("option", rule.name);
      opt.attribute("value", `custom:${rule.name}`);
      opt.parent(customGroup);
    });

    // Create option
    const createOpt = p.createElement("option", "Create...");
    createOpt.attribute("value", "create");
    createOpt.parent(customGroup);

    // Set to the newly saved rule
    (this.ruleSelect as any).value(`custom:${this.selectedRule.name}`);
  }

  private updateStats() {
    const volatileCount = Array.from(this.volatile.values()).reduce((sum, ySet) => sum + ySet.size, 0);
    const hoverText = this.getHoverInfo();

    if (this.cellCountStat) {
      this.cellCountStat.html(
        `<span>Cells</span><span class="sketch-controls__stat-value">${this.allCells().length}</span>`
      );
    }

    if (this.volatileStat) {
      this.volatileStat.html(`<span>Active</span><span class="sketch-controls__stat-value">${volatileCount}</span>`);
    }

    if (this.scaleStat) {
      this.scaleStat.html(
        `<span>Zoom</span><span class="sketch-controls__stat-value">${this.config.scale.toFixed(2)}x</span>`
      );
    }

    if (this.centerStat) {
      this.centerStat.html(
        `<span>Pan</span><span class="sketch-controls__stat-value">(${this.config.center.x.toFixed(
          0
        )}, ${this.config.center.y.toFixed(0)})</span>`
      );
    }

    if (this.hoverInfo) {
      this.hoverInfo.html(hoverText);
    }
  }

  private getHoverInfo(): string {
    const pos = this.mouseToGridPos();
    const cell = this.get(pos);
    if (cell) {
      return `${cell.rule.name} at (${pos.x}, ${pos.y}) • decay: ${cell.getDecay().toFixed(2)}`;
    }
    return `Empty cell at (${pos.x}, ${pos.y})`;
  }

  private calculateFit(): { scale: number; center: p5.Vector } | null {
    const cells = this.allCells();
    if (cells.length === 0) return null;

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    cells.forEach(cell => {
      const { x, y } = cell.position;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const s = this.config.sketch;
    const padding = 40; // pixels of padding on each side
    const scaleX = (s.width - padding * 2) / width;
    const scaleY = (s.height - padding * 2) / height;
    const scale = Math.min(scaleX, scaleY, 30);

    // Calculate center of all cells in world coordinates
    // Add 0.5 to account for cells being drawn from top-left corner
    const centerX = (minX + maxX) / 2 + 0.5;
    const centerY = (minY + maxY) / 2 + 0.5;

    // Convert to screen space offset (negated because we're translating the world)
    const center = s.createVector(-centerX * scale, -centerY * scale);

    return { scale, center };
  }

  private dataHTML = () => {
    const hoverInfo = this.getHoverInfo();
    const volatileCount = Array.from(this.volatile.values()).reduce((sum, ySet) => sum + ySet.size, 0);

    return `
      <div class="sketch-info__line">
        <span class="sketch-info__label">Cells:</span>
        <span class="sketch-info__value">${this.allCells().length}</span>
      </div>
      <div class="sketch-info__line">
        <span class="sketch-info__label">Volatile:</span>
        <span class="sketch-info__value">${volatileCount}</span>
      </div>
      <div class="sketch-info__line">
        <span class="sketch-info__label">FPS:</span>
        <span class="sketch-info__value">${this.config.sketch.frameRate().toFixed(1)}</span>
      </div>
      <div class="sketch-info__line">
        <span class="sketch-info__label">Scale:</span>
        <span class="sketch-info__value">${this.config.scale.toFixed(2)}</span>
      </div>
      <div class="sketch-info__line">
        <span class="sketch-info__label">Center:</span>
        <span class="sketch-info__value">(${this.config.center.x.toFixed(0)}, ${this.config.center.y.toFixed(0)})</span>
      </div>
      <div class="sketch-info__highlight">${hoverInfo}</div>
    `;
  };

  private dataText = () =>
    [
      `Cells:  ${this.allCells().length}`,
      `Volatile: ${Array.from(this.volatile.values()).reduce((sum, ySet) => sum + ySet.size, 0)}`,
      this.getHoverInfo(),
      `Scale: ${this.config.scale.toFixed(2)}`,
      `Center: (${this.config.center.x.toFixed(1)}, ${this.config.center.y.toFixed(1)})`,
      `Mode: ${this.autoZoom ? "Auto-Zoom" : "Manual"}`,
    ].join("\n");
}
