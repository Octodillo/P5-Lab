import p5 from "p5";
import { button, checkbox, divider, numberInput, section, stat } from "../../../controls.ts";
import { receive, Sketch } from "../../../lab.ts";
import { cross } from "../../../common.ts";

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

const Controller = [
  section("Playback", [button("clearAttractors", "Clear Attractors")]),
  divider(),
  section("Particle Settings", [
    numberInput("maxParticles", 300, "Max Particles"),
    numberInput("emissionRate", 3, "Emission Rate"),
    checkbox("showTrails", "Show Trails"),
  ]),
  divider(),
  section("Attractor Settings", [
    numberInput("attractorStrength", 40, "Attractor Strength"),
    numberInput("repulsorStrength", -30, "Repulsor Strength"),
  ]),
  divider(),
  section("Stats", [stat("particleCount", ""), stat("attractorCount", "")]),
  divider(),
  section("Info", [
    stat("instructions", "Drag: Move emitter<br>Click: Add attractor<br>Right click: Add repulsor"),
  ]),
];

class ParticleSystem extends Sketch<typeof Controller> {
  readonly schema = Controller;

  particles: Particle[] = [];
  attractors: Attractor[] = [];
  emitter = this.p5.createVector(0, 0);

  override setup(): void {
    const { p5 } = this;
    p5.colorMode(p5.HSB, 360, 100, 100, 100);
    this.controls.subscribe("clearAttractors", () => (this.attractors = []));
    this.p5.translate(this.p5.width / 2, this.p5.height / 2);

    // Add some initial attractors
    this.attractors.push({
      position: p5.createVector(p5.width * 0.25, p5.height * 0.33),
      strength: 50,
      radius: 80,
    });

    this.attractors.push({
      position: p5.createVector(p5.width * 0.75, p5.height * 0.66),
      strength: -30,
      radius: 60,
    });

    // Mouse interactions
    this.p5.mouseDragged = () => {
      this.emitter.set(this.p5.mouseX, this.p5.mouseY);
    };

    this.p5.mousePressed = () => {
      if (this.p5.mouseButton === this.p5.LEFT) {
        // Add attractor
        this.attractors.push({
          position: this.p5.createVector(this.p5.mouseX, this.p5.mouseY),
          strength: this.controls.values.attractorStrength,
          radius: 70,
        });
      } else if (this.p5.mouseButton === this.p5.RIGHT) {
        // Add repulsor
        this.attractors.push({
          position: this.p5.createVector(this.p5.mouseX, this.p5.mouseY),
          strength: this.controls.values.repulsorStrength,
          radius: 60,
        });
      }
    };

    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  override update(): void {
    const { emissionRate, maxParticles, particleCount } = this.controls.values;

    // Spawn new particles
    this.particles.push(
      ...Array.from(
        { length: Math.min(maxParticles - Number(particleCount), emissionRate) },
        (_) => ({
          position: this.emitter.copy(),
          velocity: p5.Vector.fromAngle(this.p5.random(this.p5.TWO_PI)).mult(
            this.p5.random(0.5, 2),
          ),
          acceleration: this.p5.createVector(0, 0),
          life: this.p5.random(100, 200),
          maxLife: 200,
          size: this.p5.random(2, 8),
          color: this.p5.color(this.p5.random(180, 300), 80, 90, 80),
        }),
      ),
    );

    // Apply each attractor to each particle
    cross(this.particles, this.attractors).forEach(([particle, attractor]) => {
      const force = p5.Vector.sub(attractor.position, particle.position);
      const distance = force.mag();

      if (distance < attractor.radius) {
        force.normalize();
        const strength = this.p5.map(distance, 0, attractor.radius, attractor.strength, 0);
        force.mult(strength * 0.001);
        particle.acceleration.add(force);
      }
    });

    this.particles.forEach((particle) => {
      particle.velocity.add(particle.acceleration);
      particle.velocity.limit(4);
      particle.position.add(particle.velocity);
    });

    this.particles = this.particles.filter((particle) => particle.life-- > 0);
  }

  override draw(): void {
    const { showTrails } = this.controls.values;
    this.p5.background(240, 20, 5, showTrails ? 15 : 100);

    this.attractors.forEach((attractor) => {
      // Attractor field visualization
      this.p5.noFill();
      this.p5.stroke(attractor.strength > 0 ? 120 : 0, 60, 60, 30);
      this.p5.strokeWeight(2);
      this.p5.ellipse(attractor.position.x, attractor.position.y, attractor.radius * 2);

      // Attractor center
      const centerColor = attractor.strength > 0 ? 120 : 0;
      this.p5.fill(centerColor, 80, 90, 80);
      this.p5.noStroke();
      this.p5.ellipse(attractor.position.x, attractor.position.y, 20);

      // Pulsing effect
      const pulse = this.p5.sin(this.p5.frameCount * 0.1) * 5;
      this.p5.fill(centerColor, 60, 100, 40);
      this.p5.ellipse(attractor.position.x, attractor.position.y, 15 + pulse);
    });

    // Emitter glow
    for (let r = 30; r > 0; r -= 3) {
      const alpha = this.p5.map(r, 0, 30, 50, 0);
      this.p5.fill(60, 100, 100, alpha);
      this.p5.noStroke();
      this.p5.ellipse(this.emitter.x, this.emitter.y, r);
    }

    // Emitter core
    this.p5.fill(60, 100, 100);
    this.p5.noStroke();
    this.p5.ellipse(this.emitter.x, this.emitter.y, 8);

    this.particles.forEach((particle) => {
      this.p5.push();

      // Calculate alpha based on life remaining
      const alpha = this.p5.map(particle.life, 0, particle.maxLife, 0, 100);
      const size = this.p5.map(particle.life, 0, particle.maxLife, 0, particle.size);

      // Particle glow
      for (let r = size + 10; r > 0; r -= 2) {
        const glowAlpha = this.p5.map(r, 0, size + 10, alpha, 0);
        this.p5.fill(
          this.p5.hue(particle.color),
          this.p5.saturation(particle.color),
          this.p5.brightness(particle.color),
          glowAlpha * 0.3,
        );
        this.p5.noStroke();
        this.p5.ellipse(particle.position.x, particle.position.y, r);
      }

      // Main particle
      this.p5.fill(
        this.p5.hue(particle.color),
        this.p5.saturation(particle.color),
        this.p5.brightness(particle.color),
        alpha,
      );
      this.p5.noStroke();
      this.p5.ellipse(particle.position.x, particle.position.y, size);

      this.p5.pop();
    });
  }
}

receive(ParticleSystem);
