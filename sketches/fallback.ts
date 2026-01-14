import { SketchController } from "./common.ts";
import { section, stat } from "./controls.ts";

// deno-lint-ignore no-explicit-any
type AnyWindow = Window & typeof globalThis & { [key: string]: any };

// Get error info from global state (set by index.js before loading this)
const errorInfo = (window as AnyWindow).__sketch_error__ || {
  sketchName: "Unknown",
  error: "Unknown error",
};

/**
 * Fallback sketch displayed when a sketch fails to load.
 * Shows an error message with the sketch name and error details.
 */
new SketchController(
  [section("Error Details", [stat("Sketch", errorInfo.sketchName), stat("Error", errorInfo.error)])],
  (p, _controls) => {
    // Animation state
    let time = 0;
    const glitchLines: { y: number; speed: number; width: number }[] = [];

    // Initialize glitch effect lines
    const initGlitchLines = () => {
      glitchLines.length = 0;
      for (let i = 0; i < 8; i++) {
        glitchLines.push({
          y: p.random(p.height),
          speed: p.random(1, 3),
          width: p.random(50, 200),
        });
      }
    };

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.colorMode(p.HSB, 360, 100, 100, 1);
      initGlitchLines();
    };

    p.draw = () => {
      // Dark background with slight red tint
      p.background(0, 30, 10);

      // Draw glitch effect lines
      p.noStroke();
      for (const line of glitchLines) {
        line.y += line.speed;
        if (line.y > p.height) {
          line.y = -20;
          line.width = p.random(50, 200);
        }

        // Glitch line with transparency
        const alpha = 0.1 + 0.05 * p.sin(time * 2 + line.y);
        p.fill(0, 60, 50, alpha);
        const x = p.random(p.width);
        p.rect(x, line.y, line.width, 2);
      }

      // Draw error icon (warning triangle)
      const centerX = p.width / 2;
      const centerY = p.height / 2 - 40;
      const iconSize = Math.min(80, p.width * 0.12);

      // Pulsing effect for icon
      const pulse = 1 + 0.05 * p.sin(time * 3);
      const scaledSize = iconSize * pulse;

      p.push();
      p.translate(centerX, centerY - 30);
      p.scale(pulse);

      // Triangle outline
      p.stroke(0, 70, 90, 0.9);
      p.strokeWeight(3);
      p.noFill();
      p.triangle(0, -scaledSize / 2, -scaledSize / 2, scaledSize / 2, scaledSize / 2, scaledSize / 2);

      // Exclamation mark
      p.fill(0, 70, 90, 0.9);
      p.noStroke();
      p.rectMode(p.CENTER);
      p.rect(0, -5, 6, 25, 2);
      p.ellipse(0, 18, 8, 8);

      p.pop();

      // Error text
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(Math.min(36, p.width * 0.06));
      p.fill(0, 0, 100, 0.9);
      p.text("Failed to Load Sketch", centerX, centerY + 50);

      // Sketch name
      p.textSize(Math.min(24, p.width * 0.04));
      p.fill(0, 60, 80, 0.8);
      p.text(`"${errorInfo.sketchName}"`, centerX, centerY + 90);

      // Error message (truncated if too long)
      p.textSize(Math.min(14, p.width * 0.025));
      p.fill(0, 0, 60, 0.6);
      let errorMsg = String(errorInfo.error);
      if (errorMsg.length > 80) {
        errorMsg = errorMsg.substring(0, 77) + "...";
      }
      p.text(errorMsg, centerX, centerY + 125);

      // Hint text
      p.textSize(Math.min(16, p.width * 0.028));
      p.fill(220, 30, 70, 0.5);
      p.text("Check the console for more details", centerX, centerY + 170);

      time += 0.05;
    };
  }
).init();
