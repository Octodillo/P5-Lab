import { Construction } from "./lib.ts";

export const hexagon = (
  _: { construction: Construction; prefix: string; center: string; edge: string },
) => {
  _.construction
    .line({
      name: `${_.prefix}_OU`,
      point1: _.center,
      point2: _.edge,
    })
    .circle({
      name: `${_.prefix}_Cir`,
      center: _.center,
      edge: _.edge,
    })
    .intersection({
      name: `${_.prefix}_A`,
      object1: `${_.prefix}_OU`,
      object2: `${_.prefix}_Cir`,
      toggle: true,
    })
    .intersection({
      name: `${_.prefix}_D`,
      object1: `${_.prefix}_OU`,
      object2: `${_.prefix}_Cir`,
    })
    .circle({
      name: `${_.prefix}_C1`,
      center: `${_.prefix}_A`,
      edge: _.center,
    })
    .circle({
      name: `${_.prefix}_C2`,
      center: `${_.prefix}_D`,
      edge: _.center,
    })
    .intersection({
      name: `${_.prefix}_B`,
      object1: `${_.prefix}_Cir`,
      object2: `${_.prefix}_C1`,
    })
    .intersection({
      name: `${_.prefix}_C`,
      object1: `${_.prefix}_Cir`,
      object2: `${_.prefix}_C2`,
      toggle: true,
    })
    .intersection({
      name: `${_.prefix}_E`,
      object1: `${_.prefix}_Cir`,
      object2: `${_.prefix}_C2`,
    })
    .intersection({
      name: `${_.prefix}_F`,
      object1: `${_.prefix}_Cir`,
      object2: `${_.prefix}_C1`,
      toggle: true,
    })
    .line({
      name: `${_.prefix}_AB`,
      point1: `${_.prefix}_A`,
      point2: `${_.prefix}_B`,
      visible: true,
      segment: true,
    })
    .line({
      name: `${_.prefix}_BC`,
      point1: `${_.prefix}_B`,
      point2: `${_.prefix}_C`,
      visible: true,
      segment: true,
    })
    .line({
      name: `${_.prefix}_CD`,
      point1: `${_.prefix}_C`,
      point2: `${_.prefix}_D`,
      visible: true,
      segment: true,
    })
    .line({
      name: `${_.prefix}_DE`,
      point1: `${_.prefix}_D`,
      point2: `${_.prefix}_E`,
      visible: true,
      segment: true,
    })
    .line({
      name: `${_.prefix}_EF`,
      point1: `${_.prefix}_E`,
      point2: `${_.prefix}_F`,
      visible: true,
      segment: true,
    })
    .line({
      name: `${_.prefix}_FA`,
      point1: `${_.prefix}_F`,
      point2: `${_.prefix}_A`,
      visible: true,
      segment: true,
    });
};
