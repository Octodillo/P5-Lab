import {
  SketchController,
  ButtonControl,
  SelectControl,
  SliderControl,
  CheckboxControl,
  StatControl,
  RowBuilder,
  SectionBuilder,
} from "../common.ts";

new SketchController((p, controls) => {
  // State
  let bgColor = 30;
  let shapeColor = "#6366f1";
  let shapeSize = 80;
  let rotation = 0;
  let rotationSpeed = 0.02;
  let isPaused = false;
  let showOutline = true;
  let shapeType: "square" | "circle" | "triangle" = "square";
  let pulseEnabled = false;
  let pulsePhase = 0;

  controls
    .section("Input Types")
    .row("Shape")
    .radio("shape", "square", "Square", true, v => (shapeType = v))
    .radio("shape", "circle", "Circle", false, v => (shapeType = v))
    .radio("shape", "triangle", "Triangle", false, v => (shapeType = v))
    .endRow()
    .row("Effects")
    .checkbox("outline", "Outline", true, c => (showOutline = c))
    .checkbox("pulsate", "Pulsate", false, c => (pulseEnabled = c))
    .endRow()
    .select("Color", ["Indigo", "Emerald", "Rose", "Amber", "Cyan"], value => {
      const colors: Record<string, string> = {
        Indigo: "#6366f1",
        Emerald: "#10b981",
        Rose: "#f43f5e",
        Amber: "#f59e0b",
        Cyan: "#06b6d4",
      };
      shapeColor = colors[value];
    })
    .slider("Size", 20, 200, shapeSize, 1, value => {
      shapeSize = value;
    })
    .stat("ShapeInfo", "");

  // =========================================================================
  // SECTION: Text Input Demo
  // =========================================================================
  let customLabel = "Hello!";

  controls
    .section("Label")
    .textInput("LabelText", customLabel, value => {
      customLabel = value;
    })
    .highlight("LabelPreview", "");

  controls.divider();

  // =========================================================================
  // SECTION: Programmatic Demo
  // =========================================================================
  controls
    .section("Programmatic")
    .row("Actions")
    .button("Random Color", () => {
      const colorSelect = controls.get("Shape").get<SelectControl>("Color");
      const options = ["Indigo", "Emerald", "Rose", "Amber", "Cyan"];
      const randomColor = options[Math.floor(Math.random() * options.length)];
      colorSelect.setValue(randomColor).change();
    })
    .button("Random Size", () => {
      const sizeSlider = controls.get("Shape").get<SliderControl>("Size");
      const randomSize = Math.floor(Math.random() * 180) + 20;
      sizeSlider.setValue(randomSize).change();
    })
    .endRow()
    .row("Toggle")
    .button("Toggle Outline", () => {
      const outlineCheckbox = controls.get("Shape").get<CheckboxControl>("Outline");
      outlineCheckbox.toggle();
    })
    .button("Toggle Pulse", () => {
      const pulseCheckbox = controls.get("Animation").get<CheckboxControl>("Pulse");
      pulseCheckbox.toggle();
    })
    .endRow()
    .stat("ClickCount", "Clicks: 0");

  let clickCount = 0;
  const originalRandomColor = controls
    .get("Programmatic")
    .get<RowBuilder>("Actions")
    .get<ButtonControl>("Random Color");

  const originalOnClick = () => {
    const colorSelect = controls.get("Shape").get<SelectControl>("Color");
    const options = ["Indigo", "Emerald", "Rose", "Amber", "Cyan"];
    const randomColor = options[Math.floor(Math.random() * options.length)];
    colorSelect.setValue(randomColor).change();
    clickCount++;
    controls.get("Programmatic").get<StatControl>("ClickCount").setText(`Clicks: ${clickCount}`);
  };

  // Re-wire the button with click counting
  originalRandomColor.element.mouseClicked(originalOnClick);

  // =========================================================================
  // DRAW
  // =========================================================================
  p.draw = () => {
    p.background(bgColor);

    if (!isPaused) {
      rotation += rotationSpeed;
      pulsePhase += 0.05;
    }

    // Calculate pulse effect
    const pulseFactor = pulseEnabled ? 1 + Math.sin(pulsePhase) * 0.2 : 1;
    const currentSize = shapeSize * pulseFactor;

    // Update stats
    controls
      .get("Input Types")
      .get<StatControl>("ShapeInfo")
      .setText(`${shapeType} | ${Math.round(currentSize)}px`);

    controls
      .get("Animation")
      .get<StatControl>("AnimInfo")
      .setText(`Rotation: ${(rotation % (Math.PI * 2)).toFixed(2)} rad`);

    controls.get("Background").get<StatControl>("BgInfo").setText(`RGB: ${bgColor}, ${bgColor}, ${bgColor}`);

    controls.get("Label").get<StatControl>("LabelPreview").setText(`"${customLabel}"`);

    // Draw shape
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(rotation);

    p.fill(shapeColor);
    if (showOutline) {
      p.stroke(255);
      p.strokeWeight(2);
    } else {
      p.noStroke();
    }

    switch (shapeType) {
      case "square":
        p.rectMode(p.CENTER);
        p.rect(0, 0, currentSize, currentSize);
        break;
      case "circle":
        p.ellipse(0, 0, currentSize, currentSize);
        break;
      case "triangle": {
        const h = (currentSize * Math.sqrt(3)) / 2;
        p.triangle(0, -h / 2, -currentSize / 2, h / 2, currentSize / 2, h / 2);
        break;
      }
    }

    p.pop();

    // Draw label
    p.push();
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(16);
    p.text(customLabel, p.width / 2, 20);
    p.pop();
  };
}).init();
