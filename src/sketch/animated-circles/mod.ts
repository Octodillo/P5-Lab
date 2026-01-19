import { initSketch } from "../../sketch.ts";
import { section, divider, numberInput, checkbox, stat } from "../../controls.ts";

interface Circle {
  x: number;
  y: number;
  radius: number;
  color: any;
  speedX: number;
  speedY: number;
  phase: number;
}

initSketch(
  [
    section("Settings", [
      numberInput("circleCount", 15, "Circle Count"),
      numberInput("maxCircles", 25, "Max Circles"),
      checkbox("showConnections", "Show Connections", true),
      stat("activeCircles", ""),
    ]),
    divider(),
    section("Info", [stat("info", "Click to add circles")]),
  ],
  ({ p5: p, controls }) => {
    let circles: Circle[] = [];
    let numCircles = 15;
    let maxCircles = 25;
    let showConnections = true;

    controls.subscribe<number>("circleCount", value => {
      numCircles = Math.max(1, Math.min(50, value));
      initCircles();
    });

    controls.subscribe<number>("maxCircles", value => {
      maxCircles = Math.max(numCircles, Math.min(100, value));
    });

    controls.subscribe<boolean>("showConnections", value => {
      showConnections = value;
    });

    function initCircles() {
      circles = [];
      for (let i = 0; i < numCircles; i++) {
        circles.push({
          x: p.random(p.width),
          y: p.random(p.height),
          radius: p.random(20, 80),
          color: p.color(p.random(360), 80, 90, 60),
          speedX: p.random(-2, 2),
          speedY: p.random(-2, 2),
          phase: p.random(p.TWO_PI),
        });
      }
    }

    p.setup = () => {
      p.colorMode(p.HSB, 360, 100, 100, 100);
      initCircles();
    };

    p.draw = () => {
      // Dark background with slight transparency for trails
      p.background(220, 20, 15, 8);

      // Update stats
      controls.set("activeCircles", `Active circles: ${circles.length}`);

      // Update and draw circles
      circles.forEach((circle, index) => {
        // Animate position
        circle.x += circle.speedX;
        circle.y += circle.speedY;

        // Pulsating radius based on time and phase
        const time = p.millis() * 0.001;
        const pulsatingRadius = circle.radius + p.sin(time * 2 + circle.phase) * 15;

        // Change color over time
        const hue = (p.frameCount * 0.5 + index * 25) % 360;
        circle.color = p.color(hue, 70 + p.sin(time + index) * 30, 85, 40);

        // Bounce off edges
        if (circle.x < 0 || circle.x > p.width) {
          circle.speedX *= -1;
          circle.x = p.constrain(circle.x, 0, p.width);
        }
        if (circle.y < 0 || circle.y > p.height) {
          circle.speedY *= -1;
          circle.y = p.constrain(circle.y, 0, p.height);
        }

        // Draw circle with glow effect
        p.push();
        p.translate(circle.x, circle.y);

        // Outer glow
        for (let r = pulsatingRadius + 30; r > 0; r -= 5) {
          const alpha = p.map(r, 0, pulsatingRadius + 30, 40, 0);
          p.fill(p.hue(circle.color), p.saturation(circle.color), p.brightness(circle.color), alpha);
          p.noStroke();
          p.ellipse(0, 0, r * 2);
        }

        // Main circle
        p.fill(circle.color);
        p.noStroke();
        p.ellipse(0, 0, pulsatingRadius * 2);

        // Inner highlight
        p.fill(p.hue(circle.color), 30, 95, 80);
        p.ellipse(-pulsatingRadius * 0.3, -pulsatingRadius * 0.3, pulsatingRadius * 0.6);

        p.pop();
      });

      // Add interactive mouse effect
      if (showConnections && p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
        p.push();
        p.stroke(60, 100, 100, 50);
        p.strokeWeight(2);
        p.noFill();

        circles.forEach(circle => {
          const distance = p.dist(p.mouseX, p.mouseY, circle.x, circle.y);
          if (distance < 150) {
            p.line(p.mouseX, p.mouseY, circle.x, circle.y);
          }
        });

        // Mouse cursor effect
        p.fill(60, 100, 100, 30);
        p.noStroke();
        p.ellipse(p.mouseX, p.mouseY, 40);
        p.pop();
      }
    };

    // Add interactivity: click to add new circle
    p.mousePressed = () => {
      if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
        circles.push({
          x: p.mouseX,
          y: p.mouseY,
          radius: p.random(30, 60),
          color: p.color(p.random(360), 80, 90, 60),
          speedX: p.random(-3, 3),
          speedY: p.random(-3, 3),
          phase: p.random(p.TWO_PI),
        });

        // Remove oldest circle if too many
        if (circles.length > maxCircles) {
          circles.shift();
        }
      }
    };

    // Reset with spacebar
    p.keyPressed = () => {
      if (p.key === " ") {
        initCircles();
      }
    };
  },
);
