import p5 from "p5";
import { initSketch } from "../../sketch.ts";
import { section, divider, numberInput, button, stat } from "../../controls.ts";

interface Particle {
  position: p5.Vector;
  velocity: p5.Vector;
  acceleration: p5.Vector;
  life: number;
  maxLife: number;
  size: number;
  color: any;
}

interface Attractor {
  position: p5.Vector;
  strength: number;
  radius: number;
}

// Interactive Particle System Sketch
initSketch(
  [
    section("Playback", [button("clearAttractors", "Clear Attractors")]),
    divider(),
    section("Particle Settings", [
      numberInput("maxParticles", 300, "Max Particles"),
      numberInput("emissionRate", 3, "Emission Rate"),
      button("toggleTrails", "Hide Trails"),
    ]),
    divider(),
    section("Attractor Settings", [
      numberInput("attractorStrength", 40, "Attractor Strength"),
      numberInput("repulsorStrength", -30, "Repulsor Strength"),
    ]),
    divider(),
    section("Stats", [stat("particleCount", ""), stat("attractorCount", "")]),
    divider(),
    section("Info", [stat("instructions", "Drag: Move emitter<br>Click: Add attractor<br>Right click: Add repulsor")]),
  ],
  ({ p5: sketch, controls }) => {
    let particles: Particle[] = [];
    let attractors: Attractor[] = [];
    let emitterPosition: p5.Vector;
    let maxParticles = 300;
    let showTrails = true;
    let emissionRate = 3;
    let attractorStrength = 40;
    let repulsorStrength = -30;

    controls.subscribe("clearAttractors", () => {
      attractors = [];
    });

    controls.subscribe<number>("maxParticles", value => {
      maxParticles = Math.max(10, Math.min(1000, value));
    });

    controls.subscribe<number>("emissionRate", value => {
      emissionRate = Math.max(1, Math.min(20, value));
    });

    controls.subscribe("toggleTrails", () => {
      showTrails = !showTrails;
      controls.set("toggleTrails", showTrails ? "Hide Trails" : "Show Trails");
    });

    controls.subscribe<number>("attractorStrength", value => {
      attractorStrength = Math.max(-100, Math.min(100, value));
    });

    controls.subscribe<number>("repulsorStrength", value => {
      repulsorStrength = Math.max(-100, Math.min(100, value));
    });

    sketch.setup = () => {
      sketch.colorMode(sketch.HSB, 360, 100, 100, 100);

      emitterPosition = sketch.createVector(sketch.width / 2, sketch.height / 2);

      // Add some initial attractors
      attractors.push({
        position: sketch.createVector(sketch.width * 0.25, sketch.height * 0.33),
        strength: 50,
        radius: 80,
      });

      attractors.push({
        position: sketch.createVector(sketch.width * 0.75, sketch.height * 0.66),
        strength: -30,
        radius: 60,
      });
    };

    sketch.draw = () => {
      if (showTrails) {
        sketch.background(240, 20, 5, 15); // Dark with transparency for trails
      } else {
        sketch.background(240, 20, 5); // Solid dark background
      }

      // Update stats
      controls.set("particleCount", `Active particles: ${particles.length} / ${maxParticles}`);
      controls.set("attractorCount", `Attractors: ${attractors.length}`);

      // Emit new particles
      if (particles.length < maxParticles) {
        for (let i = 0; i < emissionRate; i++) {
          emitParticle();
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        // Apply forces from attractors
        attractors.forEach(attractor => {
          applyAttraction(particle, attractor);
        });

        // Update particle physics
        particle.velocity.add(particle.acceleration);
        particle.velocity.limit(4); // Max speed
        particle.position.add(particle.velocity);
        particle.acceleration.mult(0); // Reset acceleration

        // Age the particle
        particle.life--;

        // Remove dead particles
        if (particle.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle
        drawParticle(particle);
      }

      // Draw attractors
      attractors.forEach(attractor => {
        drawAttractor(attractor);
      });

      // Draw emitter
      drawEmitter();
    };

    function emitParticle(): void {
      const angle = sketch.random(sketch.TWO_PI);
      const speed = sketch.random(0.5, 2);

      const particle: Particle = {
        position: emitterPosition.copy(),
        velocity: p5.Vector.fromAngle(angle).mult(speed),
        acceleration: sketch.createVector(0, 0),
        life: sketch.random(100, 200),
        maxLife: 200,
        size: sketch.random(2, 8),
        color: sketch.color(sketch.random(180, 300), 80, 90, 80),
      };

      particles.push(particle);
    }

    function applyAttraction(particle: Particle, attractor: Attractor): void {
      const force = p5.Vector.sub(attractor.position, particle.position);
      const distance = force.mag();

      if (distance < attractor.radius) {
        force.normalize();
        const strength = sketch.map(distance, 0, attractor.radius, attractor.strength, 0);
        force.mult(strength * 0.001);
        particle.acceleration.add(force);
      }
    }

    function drawParticle(particle: Particle): void {
      sketch.push();

      // Calculate alpha based on life remaining
      const alpha = sketch.map(particle.life, 0, particle.maxLife, 0, 100);
      const size = sketch.map(particle.life, 0, particle.maxLife, 0, particle.size);

      // Particle glow
      for (let r = size + 10; r > 0; r -= 2) {
        const glowAlpha = sketch.map(r, 0, size + 10, alpha, 0);
        sketch.fill(
          sketch.hue(particle.color),
          sketch.saturation(particle.color),
          sketch.brightness(particle.color),
          glowAlpha * 0.3,
        );
        sketch.noStroke();
        sketch.ellipse(particle.position.x, particle.position.y, r);
      }

      // Main particle
      sketch.fill(
        sketch.hue(particle.color),
        sketch.saturation(particle.color),
        sketch.brightness(particle.color),
        alpha,
      );
      sketch.noStroke();
      sketch.ellipse(particle.position.x, particle.position.y, size);

      sketch.pop();
    }

    function drawAttractor(attractor: Attractor): void {
      sketch.push();

      // Attractor field visualization
      sketch.noFill();
      sketch.stroke(attractor.strength > 0 ? 120 : 0, 60, 60, 30);
      sketch.strokeWeight(2);
      sketch.ellipse(attractor.position.x, attractor.position.y, attractor.radius * 2);

      // Attractor center
      const centerColor = attractor.strength > 0 ? 120 : 0;
      sketch.fill(centerColor, 80, 90, 80);
      sketch.noStroke();
      sketch.ellipse(attractor.position.x, attractor.position.y, 20);

      // Pulsing effect
      const pulse = sketch.sin(sketch.frameCount * 0.1) * 5;
      sketch.fill(centerColor, 60, 100, 40);
      sketch.ellipse(attractor.position.x, attractor.position.y, 15 + pulse);

      sketch.pop();
    }

    function drawEmitter(): void {
      sketch.push();

      // Emitter glow
      for (let r = 30; r > 0; r -= 3) {
        const alpha = sketch.map(r, 0, 30, 50, 0);
        sketch.fill(60, 100, 100, alpha);
        sketch.noStroke();
        sketch.ellipse(emitterPosition.x, emitterPosition.y, r);
      }

      // Emitter core
      sketch.fill(60, 100, 100);
      sketch.noStroke();
      sketch.ellipse(emitterPosition.x, emitterPosition.y, 8);

      sketch.pop();
    }

    // Mouse interactions
    sketch.mouseDragged = () => {
      emitterPosition.set(sketch.mouseX, sketch.mouseY);
    };

    sketch.mousePressed = () => {
      if (sketch.mouseButton === sketch.LEFT) {
        // Add attractor
        attractors.push({
          position: sketch.createVector(sketch.mouseX, sketch.mouseY),
          strength: attractorStrength,
          radius: 70,
        });
      } else if (sketch.mouseButton === sketch.RIGHT) {
        // Add repulsor
        attractors.push({
          position: sketch.createVector(sketch.mouseX, sketch.mouseY),
          strength: repulsorStrength,
          radius: 60,
        });
      }
    };

    // Prevent context menu on right click
    document.addEventListener("contextmenu", e => e.preventDefault());
  },
);
