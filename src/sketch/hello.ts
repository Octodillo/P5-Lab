import { slider, section, textInput } from "../controls.ts";
import { Sketch, receive } from "../lab.ts";
import { Pool } from "../common.ts";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
}

const Controller = [
  section("Title", [
    textInput("titleText", "P5 Lab", "Title", "Title"),
    slider("timeScale", 1, 20, 2, 1, "Wiggle"),
    slider("titleTranslationAmplitude", 0, 30, 10, 1, "Waggle"),
    slider("titleRotationAmplitude", 0, 0.2, 0.01, 0.01, "Wobble"),
    slider("titleScalingAmplitude", 0, 0.3, 0, 0.01, "Wooble"),
  ]),
  section("Particles", [
    slider("particleCount", 10, 500, 50, 1, "Flousish"),
    slider("particleAlphaAmplitude", 0, 1, 0.3, 0.1, "Flicker"),
    slider("particleTranslationAmplitude", 0, 1, 0.4, 0.01, "Flutter"),
    slider("particleWavelength", 0, 3, 1, 0.1, "Float"),
  ]),
];

const wave = (time: number, frequency: number, amplitude?: number, phase?: number) =>
  Math.sin((frequency * time) / 1000 + (phase ?? 0)) * (amplitude ?? 1);

class Hello extends Sketch<typeof Controller> {
  readonly schema = Controller;

  private particles!: Pool<Particle>;

  override setup(): void {
    const { p5 } = this;

    this.particles = new Pool(() => ({
      x: p5.random(p5.width),
      y: p5.random(p5.height),
      vx: p5.random(-1, 1),
      vy: p5.random(-1, 1),
      radius: p5.random(3, 8),
      hue: p5.random(180, 280), // Purple to blue range
    }));

    this.controls.subscribe("particleCount", count => this.particles.resize(count));
  }

  update(): void {
    const { timeScale, particleTranslationAmplitude, particleWavelength } = this.controls.values;

    this.particles.forEach((particle, index) => {
      // Float across the screen
      particle.x +=
        (particle.vx + wave(this.time, 0.5, particleTranslationAmplitude, particle.y * 0.1 + index * 0.7)) *
        particleWavelength;
      particle.y +=
        (particle.vy + wave(this.time, 0.3, particleTranslationAmplitude * 0.6, particle.x * 0.1 + index * 0.9)) *
        particleWavelength;

      // Wrap around edges
      const pad = particle.radius * 2;
      if (particle.x < -pad) particle.x = this.p5.width + pad;
      if (particle.y < -pad) particle.y = this.p5.height + pad;
      if (particle.x > this.p5.width + pad) particle.x = -pad;
      if (particle.y > this.p5.height + pad) particle.y = -pad;
    });

    this.time += timeScale * this.p5.deltaTime;
  }

  draw(): void {
    const { p5 } = this;

    p5.colorMode(p5.HSB, 360, 100, 100, 1);
    p5.background(240, 20, 12);

    const {
      titleText,
      titleTranslationAmplitude,
      titleRotationAmplitude,
      titleScalingAmplitude,
      particleAlphaAmplitude,
    } = this.controls.values;

    // Draw particles
    this.particles.forEach(particle => {
      // Draw glow
      const alpha = 0.3 * (1 + wave(this.time, 0.3, particleAlphaAmplitude, particle.hue * 0.1));
      const diameter = particle.radius * 2;
      p5.noStroke();
      p5.fill(particle.hue, 60, 80, alpha);
      p5.ellipse(particle.x, particle.y, diameter * 2);

      // Draw particle
      p5.fill(particle.hue, 40, 95, alpha * 0.8);
      p5.ellipse(particle.x, particle.y, diameter);
    });

    const centerX = p5.width / 2;
    const centerY = p5.height / 2;
    const maxxed = false; //isMaxxedOut();

    p5.textAlign(p5.CENTER, p5.CENTER);

    p5.push();
    const waggleX = wave(this.time, 0.3, titleTranslationAmplitude * 0.2);
    const waggleY = wave(this.time, 0.7, titleTranslationAmplitude);
    p5.translate(centerX + waggleX, centerY - 40 + waggleY);

    p5.rotate(wave(this.time, 1, titleRotationAmplitude));

    const woobled = 1 + wave(this.time, 0.4, titleScalingAmplitude);
    p5.textSize(Math.min(72, p5.width * 0.08) * woobled);

    p5.fill((this.time * 5) % 360, maxxed ? 100 : 0, 100, 0.9);
    p5.text(titleText, 0, 0);
    p5.pop();

    // Subtitle
    p5.textSize(Math.min(20, p5.width * 0.035));
    p5.fill(220, 30, 80, 0.7);
    p5.text(maxxed ? "You. I like you." : "Select a sketch from the sidebar to begin", centerX, centerY + 40);
  }

  private time = 0;
}

receive(Hello);
