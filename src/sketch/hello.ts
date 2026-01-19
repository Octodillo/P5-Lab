import { initSketch } from "../sketch.ts";
import { slider, section, SliderDesc } from "../controls.ts";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
}

/**
 * Welcome sketch displayed when the page first loads.
 * Shows a friendly greeting with animated visual elements.
 */
initSketch(
  [
    section("Hello", [
      slider("wiggle", 1, 20, 2, 1, "Wiggle"),
      slider("waggle", 0, 30, 10, 1, "Waggle"),
      slider("wobble", 0, 0.2, 0.01, 0.01, "Wobble"),
      slider("wooble", 0, 0.3, 0, 0.01, "Wooble"),
    ]),
    section("Particles", [
      slider("number", 10, 500, 50, 1),
      slider("flicker", 0, 1, 0.3, 0.1),
      slider("flutter", 0, 1, 0.4, 0.01),
      slider("float", 0, 3, 1, 0.1),
    ]),
  ],
  ({ p5, controls }) => {
    const spawnParticle = (spec?: Partial<Particle>): Particle => ({
      x: p5.random(p5.width),
      y: p5.random(p5.height),
      vx: p5.random(-1, 1),
      vy: p5.random(-1, 1),
      radius: p5.random(3, 8),
      hue: p5.random(180, 280), // Purple to blue range
      ...spec,
    });
    const spawnParticles = (count: number) => new Array(count).fill(0).map(_ => spawnParticle());
    const syncParticles = (count: number) => {
      const difference = count - particles.length;
      if (difference > 0) particles.push(...spawnParticles(difference));
      if (difference < 0) particles.splice(0, -difference);
    };
    const particles: Particle[] = [];
    controls.subscribe<number>("number", syncParticles);

    let time = 0;

    const isMaxxedOut = () =>
      ![
        controls.get<number>("wiggle") === controls.about<SliderDesc>("wiggle")?.max,
        controls.get<number>("waggle") === controls.about<SliderDesc>("waggle")?.max,
        controls.get<number>("wobble") === controls.about<SliderDesc>("wobble")?.max,
        controls.get<number>("wooble") === controls.about<SliderDesc>("wooble")?.max,

        controls.get<number>("number") === controls.about<SliderDesc>("number")?.max,
        controls.get<number>("flicker") === controls.about<SliderDesc>("flicker")?.max,
        controls.get<number>("flutter") === controls.about<SliderDesc>("flutter")?.max,
        controls.get<number>("float") === controls.about<SliderDesc>("float")?.max,
      ].includes(false);

    let _offset = 0;
    const offset = (amount = 0.7) => (_offset += amount);
    const unoffset = () => (_offset = 0);
    const wave = (frequency: number, amplitude?: number, phase?: number) =>
      p5.sin(frequency * time + (phase ?? 0) + offset()) * (amplitude ?? 1);

    p5.draw = () => {
      p5.colorMode(p5.HSB, 360, 100, 100, 1);
      // Dark gradient background
      p5.background(240, 20, 12);
      const wiggle = controls.get<number>("wiggle");
      const waggle = controls.get<number>("waggle");
      const wobble = controls.get<number>("wobble");
      const wooble = controls.get<number>("wooble");
      const float = controls.get<number>("float");
      const flutter = controls.get<number>("flutter");
      const flicker = controls.get<number>("flicker");

      // Update and draw particles
      particles.forEach(particle => {
        particle.x += (particle.vx + wave(0.5, flutter, particle.y * 0.1)) * float;
        particle.y += (particle.vy + wave(0.3, flutter * 0.6, particle.x * 0.1)) * float;

        // Wrap around edges
        const pad = particle.radius * 2;
        if (particle.x < -pad) particle.x = p5.width + pad;
        if (particle.y < -pad) particle.y = p5.height + pad;
        if (particle.x > p5.width + pad) particle.x = -pad;
        if (particle.y > p5.height + particle.radius) particle.y = -pad;

        // Draw particle with glow effect
        const alpha = 0.3 * (1 + wave(0.3, flicker, particle.hue * 0.1));
        p5.noStroke();
        p5.fill(particle.hue, 60, 80, alpha);
        const diameter = particle.radius * 2;
        p5.ellipse(particle.x, particle.y, diameter * 2);

        p5.fill(particle.hue, 40, 95, alpha * 0.8);
        p5.ellipse(particle.x, particle.y, diameter);
      });
      unoffset();

      const centerX = p5.width / 2;
      const centerY = p5.height / 2;
      const maxxed = isMaxxedOut();

      p5.textAlign(p5.CENTER, p5.CENTER);

      p5.push();
      const waggleX = wave(0.3, waggle * 0.2, offset());
      const waggleY = wave(0.7, waggle, offset());
      p5.translate(centerX + waggleX, centerY - 40 + waggleY);

      p5.rotate(wave(1, wobble, offset()));

      const woobled = 1 + wave(0.4, wooble, offset());
      p5.textSize(Math.min(72, p5.width * 0.08) * woobled);

      p5.fill((time * 5) % 360, maxxed ? 100 : 0, 100, 0.9);
      p5.text("P5 Lab", 0, 0);
      p5.pop();

      // Subtitle
      p5.textSize(Math.min(20, p5.width * 0.035));
      p5.fill(220, 30, 80, 0.7);
      p5.text(maxxed ? "You. I like you." : "Select a sketch from the sidebar to begin", centerX, centerY + 40);

      const seconds = p5.deltaTime / 1000;
      time += wiggle * seconds;
    };
  },
);
