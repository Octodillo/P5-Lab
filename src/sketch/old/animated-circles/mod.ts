import { checkbox, divider, numberInput, section, stat } from "../../../controls.ts";
import { receive, Sketch } from "../../../lab.ts";
import { Pool } from "../../../util.ts";

interface Circle {
  x: number;
  y: number;
  radius: number;
  color: any;
  speedX: number;
  speedY: number;
  phase: number;
}

const Controller = [
  section("Settings", [
    numberInput("circleCount", 15, "Circle Count"),
    numberInput("maxCircles", 25, "Max Circles"),
    checkbox("showConnections", "Show Connections", true),
    stat("activeCircles", ""),
  ]),
  divider(),
  section("Info", [stat("info", "Click to add circles")]),
];

class AnimatedCircles extends Sketch<typeof Controller> {
  readonly schema = Controller;
  private circles!: Pool<Circle>;

  override setup(): void {
    const { p5 } = this;
    p5.colorMode(p5.HSB, 360, 100, 100, 100);

    this.circles = new Pool(() => ({
      x: p5.random(p5.width),
      y: p5.random(p5.height),
      radius: p5.random(20, 80),
      color: p5.color(p5.random(360), 80, 90, 60),
      speedX: p5.random(-2, 2),
      speedY: p5.random(-2, 2),
      phase: p5.random(p5.TWO_PI),
    }));

    this.controls.subscribe("circleCount", count => this.circles.resize(count));

    p5.mousePressed = () => {
      if (p5.mouseX < 0 || p5.mouseX > p5.width || p5.mouseY < 0 || p5.mouseY > p5.height) return;
      this.controls.set("circleCount", this.controls.values.circleCount + 1);
      if (this.circles.length > this.controls.values.maxCircles)
        this.controls.set("circleCount", this.controls.values.maxCircles);
    };
  }

  override update(): void {}

  override draw(): void {
    const { p5 } = this;
    p5.colorMode(p5.HSB, 360, 100, 100, 100);

    // Dark background with slight transparency for trails
    p5.background(220, 20, 15, 1);

    // Update stats
    this.controls.set("activeCircles", `Active circles: ${this.circles.length}`);

    // Update and draw circles
    this.circles.forEach(circle => {
      // Animate position
      circle.x += circle.speedX;
      circle.y += circle.speedY;

      // Pulsating radius based on time and phase
      const time = p5.millis() * 0.001;
      const pulsatingRadius = circle.radius + p5.sin(time * 2 + circle.phase) * 15;

      // Change color over time
      const hue = (p5.hue(circle.color) + p5.deltaTime * 0.05) % 360;
      circle.color = p5.color(hue, 70 + p5.sin(time + circle.phase) * 30, 85, 40);

      // Bounce off edges
      if (circle.x < 0 || circle.x > p5.width) {
        circle.speedX *= -1;
        circle.x = p5.constrain(circle.x, 0, p5.width);
      }
      if (circle.y < 0 || circle.y > p5.height) {
        circle.speedY *= -1;
        circle.y = p5.constrain(circle.y, 0, p5.height);
      }

      // Draw circle with glow effect
      p5.push();
      p5.translate(circle.x, circle.y);

      // Outer glow
      for (let r = pulsatingRadius + 30; r > 0; r -= 5) {
        const alpha = p5.map(r, 0, pulsatingRadius + 30, 40, 0);
        p5.fill(p5.hue(circle.color), p5.saturation(circle.color), p5.brightness(circle.color), alpha);
        p5.noStroke();
        p5.ellipse(0, 0, r * 2);
      }

      // Main circle
      p5.fill(circle.color);
      p5.noStroke();
      p5.ellipse(0, 0, pulsatingRadius * 2);

      // Inner highlight
      p5.fill(p5.hue(circle.color), 30, 95, 80);
      p5.ellipse(-pulsatingRadius * 0.3, -pulsatingRadius * 0.3, pulsatingRadius * 0.6);

      p5.pop();
    });

    // Add interactive mouse effect
    if (
      this.controls.values.showConnections &&
      p5.mouseX > 0 &&
      p5.mouseX < p5.width &&
      p5.mouseY > 0 &&
      p5.mouseY < p5.height
    ) {
      p5.push();
      p5.stroke(60, 100, 100, 50);
      p5.strokeWeight(2);
      p5.noFill();

      this.circles.forEach(circle => {
        const distance = p5.dist(p5.mouseX, p5.mouseY, circle.x, circle.y);
        if (distance < 150) {
          p5.line(p5.mouseX, p5.mouseY, circle.x, circle.y);
        }
      });

      // Mouse cursor effect
      p5.fill(60, 100, 100, 30);
      p5.noStroke();
      p5.ellipse(p5.mouseX, p5.mouseY, 40);
      p5.pop();
    }
  }
}

receive(AnimatedCircles);

// initSketch(({ p5: p, controls }) => {
//   let circles: Circle[] = [];
//   let numCircles = 15;
//   let maxCircles = 25;
//   let showConnections = true;

//   controls.subscribe<number>("circleCount", value => {
//     numCircles = Math.max(1, Math.min(50, value));
//     initCircles();
//   });

//   controls.subscribe<number>("maxCircles", value => {
//     maxCircles = Math.max(numCircles, Math.min(100, value));
//   });

//   controls.subscribe<boolean>("showConnections", value => {
//     showConnections = value;
//   });

//   function initCircles() {
//     circles = [];
//     for (let i = 0; i < numCircles; i++) {
//       circles.push({
//         x: p.random(p.width),
//         y: p.random(p.height),
//         radius: p.random(20, 80),
//         color: p.color(p.random(360), 80, 90, 60),
//         speedX: p.random(-2, 2),
//         speedY: p.random(-2, 2),
//         phase: p.random(p.TWO_PI),
//       });
//     }
//   }

//   // Add interactivity: click to add new circle
//   p.mousePressed = () => {
//     if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
//       circles.push({
//         x: p.mouseX,
//         y: p.mouseY,
//         radius: p.random(30, 60),
//         color: p.color(p.random(360), 80, 90, 60),
//         speedX: p.random(-3, 3),
//         speedY: p.random(-3, 3),
//         phase: p.random(p.TWO_PI),
//       });

//       // Remove oldest circle if too many
//       if (circles.length > maxCircles) {
//         circles.shift();
//       }
//     }
//   };

//   // Reset with spacebar
//   p.keyPressed = () => {
//     if (p.key === " ") {
//       initCircles();
//     }
//   };
// });
