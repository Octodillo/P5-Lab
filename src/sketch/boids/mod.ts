import { initSketch } from "../../lab.ts";
import { Boid, cruise, contain, seek, flock, average, flee } from "./boid.ts";
import { section, slider, checkbox, row, radio } from "../../controls.ts";
import { cases, condition } from "../../decision.ts";

const rand = (max = 1) => Math.random() * max;
const nudge = (range = 1) => 2 * (0.5 - rand()) * range;

initSketch(
  [
    section("Flocking Forces", [
      slider("alignment", 0, 5, 1, 0.1),
      slider("cohesion", 0, 1, 0.1, 0.01),
      slider("separation", 0, 500, 100, 10),
      slider("separationReach", 0.5, 5, 2, 0.1),
    ]),
    section("Boundary", [slider("containment", 0, 1, 0.5, 0.01)]),
    section("Speed", [slider("targetSpeed", 0, 10, 3, 0.1), slider("speedControl", 0, 1, 0.3, 0.01)]),
    section("Display", [checkbox("showCollisions", "Show Collisions", true)]),
    section("Mouse", [
      row([
        radio("mouseBehavior", "flee", "Flee", true),
        radio("mouseBehavior", "ignore", "Ignore"),
        radio("mouseBehavior", "seek", "Seek"),
      ]),
      slider("mouseForce", 0, 1, 0.1, 0.01),
    ]),
  ],
  ({ p5, controls }) => {
    p5.colorMode("hsb", 1.0);

    // Track force parameters
    let alignmentStrength = 1;
    let cohesionStrength = 0.1;
    let separationStrength = 100;
    let separationReach = 2;
    let containmentStrength = 5;
    let targetSpeed = 3;
    let speedControl = 0.3;
    let showCollisions = true;
    let mouseForce = 0.1;
    let mouseBehavior = "flee";

    // Subscribe to control changes
    controls.subscribe<number>("alignment", v => (alignmentStrength = v));
    controls.subscribe<number>("cohesion", v => (cohesionStrength = v));
    controls.subscribe<number>("separation", v => (separationStrength = v));
    controls.subscribe<number>("separationReach", v => (separationReach = v));
    controls.subscribe<number>("containment", v => (containmentStrength = v));
    controls.subscribe<number>("targetSpeed", v => (targetSpeed = v));
    controls.subscribe<number>("speedControl", v => (speedControl = v));
    controls.subscribe<boolean>("showCollisions", v => (showCollisions = v));
    controls.subscribe<number>("mouseForce", v => (mouseForce = v));
    controls.subscribe<string>("mouseBehavior", v => (mouseBehavior = v));

    // Create force function that reads current values
    const getForce = () =>
      average(
        flock(alignmentStrength, cohesionStrength, separationStrength, separationReach),
        contain(p5, containmentStrength),
        cruise(targetSpeed, speedControl),
        cases(
          {
            flee: flee(mousePos, mouseForce),
            seek: seek(mousePos, mouseForce),
            ignore: p5.createVector(0, 0),
          },
          mouseBehavior,
        ),
      );

    // Add a special "hero" boid we can observe
    const mousePos = p5.createVector(0, 0);

    const boids: Boid[] = [
      new Boid({
        position: p5.createVector(0, 0),
        velocity: p5.createVector(0, 0),
        perception: { radius: 100, angle: 360 },
        display: {
          color: p5.color("red"),
          size: 50,
          // perception: true,
        },
        steering: getForce,
      }),
    ];

    p5.setup = () => {
      boids.push(
        ...new Array(300).fill(0).map(
          _ =>
            new Boid({
              display: { size: 5, color: p5.color(rand(), rand(), rand()) },
              perception: { radius: 60 + 10 * nudge(), angle: 270 + nudge(30) },
              velocity: p5.createVector(nudge(5), nudge(5)),
              position: p5.createVector(nudge(p5.width / 2), nudge(p5.height / 2)),
              steering: getForce,
            }),
        ),
      );
    };

    p5.draw = () => {
      mousePos.set(p5.mouseX, p5.mouseY);

      p5.translate(p5.width / 2, p5.height / 2);
      p5.background(0.1);

      // Update mouse position relative to center
      mousePos.set(p5.mouseX - p5.width / 2, p5.mouseY - p5.height / 2);

      boids.forEach(b => b.updateVelocity(boids));
      boids.forEach(b => b.updatePosition());
      boids.forEach(b => b.draw(p5));

      // Count collisions (only check unique pairs)
      if (showCollisions) {
        let collisions = 0;
        for (let i = 0; i < boids.length; i++) {
          for (let j = i + 1; j < boids.length; j++) {
            const distSq = boids[i].distanceSquared(boids[j]);
            const minDist = boids[i].config.display.size + boids[j].config.display.size;
            if (distSq < minDist * minDist) collisions++;
          }
        }

        // Display collision rate
        p5.resetMatrix();
        p5.fill("white");
        p5.text(`Collisions: ${collisions} (${((collisions / boids.length) * 100).toFixed(1)}%)`, 10, 20);
      }
    };
  },
);
