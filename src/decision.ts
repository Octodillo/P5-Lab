import { flee, seek } from "./sketch/boids/boid.ts";

export type Decider<T, Context = undefined> = T | ((context: Context) => Decider<T, Context>);
export function decide<T, Context = undefined>(decider: Decider<T, Context>, context: Context): T {
  while (decider instanceof Function) decider = decider(context);
  return decider;
}

type Maybe<T> = T | undefined;
type Definite<T> = Exclude<T, undefined>;
export type MultiDecider<T extends Record<string, unknown>, Context> = {
  [K in keyof T]: Decider<T[K], Context>;
};

/**
 * Due to limitations in Typescript, a universal type-safe multiDecide function is not possible.
 * The user must implement it themself. The following pattern is recommended:
 *
 * ```ts
 * interface AB { a: ..., b: ... }
 *
 * function multiDecideAB(
 *   deciders: MultiDecider<AB, Context>,
 *   context: Context
 * ): T {
 *   const result: Partial<AB> = {};
 *   const a = decide(deciders.a, context);
 *   if (a !== undefined) result.a = a;
 *   const b = decide(deciders.b, context);
 *   if (b !== undefined) result.b = b;
 *   return result as AB;
 * }
 * ```
 */
export const multiDecide = undefined as never;

export function condition<T, Context>(
  predicate: (context: Context) => boolean,
  effect: Decider<T, Context>,
): Decider<Maybe<T>, Context>;
export function condition<T, Context>(
  predicate: (context: Context) => boolean,
  effect: Decider<T, Context>,
  otherwise: Decider<T, Context>,
): Decider<T, Context>;
export function condition<T, Context>(
  predicate: (context: Context) => boolean,
  effect: Decider<T, Context>,
  otherwise?: Decider<T, Context>,
): Decider<Maybe<T>, Context> {
  return (context: Context) => {
    if (predicate(context)) return effect;
    if (otherwise) return otherwise;
  };
}

export function chance<T, Context>(chance: number, effect: Decider<T, Context>): Decider<Maybe<T>, Context>;
export function chance<T, Context>(
  chance: number,
  effect: Decider<T, Context>,
  otherwise: Decider<T, Context>,
): Decider<T, Context>;
export function chance<T, Context>(
  chance: number,
  effect: Decider<T, Context>,
  otherwise?: Decider<T, Context>,
): Decider<T | Maybe<T>, Context> {
  return condition(_ => Math.random() < chance, effect, otherwise);
}

export const choose =
  <T, Context>(...choices: Decider<T, Context>[]): Decider<T, Context> =>
  _ =>
    choices[Math.floor(Math.random() * choices.length)];

interface WeightedRandomEntry<T, Context> {
  entry: Decider<T, Context>;
  weight: number;
}
export const weighted =
  <T, Context>(...entries: WeightedRandomEntry<T, Context>[]): Decider<T, Context> =>
  _ => {
    const total = entries.reduce((a, b) => a + b.weight, 0);
    const rand = Math.random() * total;
    let current = 0;
    for (const { entry, weight } of entries) {
      current += weight;
      if (rand < current) return entry;
    }
    throw new Error("Weighted random failed!?");
  };

export const cycle = <T, Context>(...choices: Decider<T, Context>[]): Decider<T, Context> => {
  let index = 0;
  return _ => {
    const choice = choices[index];
    index = (index + 1) % choices.length;
    return choice;
  };
};

export function multiple<T, Context>(effect: Decider<T, Context>[], filterUndefined: true): Decider<T[], Context>;
export function multiple<T, Context>(
  effect: Decider<T, Context>[],
  filterUndefined: false,
): Decider<Maybe<T>[], Context>;
export function multiple<T, Context>(
  effect: Decider<T, Context>[],
  filterUndefined = true,
): Decider<T[] | Maybe<T>[], Context> {
  return context => {
    const result = effect.map(e => decide(e, context));
    if (filterUndefined) return result.filter((x): x is Definite<T> => x !== undefined);
    return result;
  };
}

export const range =
  (min: number, max: number, distribution: Decider<number> = Math.random): Decider<number> =>
  _ =>
    decide(distribution, undefined) * (max - min) + min;

export const fallback =
  <T>(decider: Decider<Maybe<T>>, fallback: T): Decider<T> =>
  context =>
    decide(decider, context) ?? fallback;

export const timeout =
  <T, Context>(decider: Decider<Promise<T>, Context>, duration: number, fallback: T): Decider<Promise<T>, Context> =>
  context =>
    Promise.race([decide(decider, context), new Promise<T>(resolve => setTimeout(() => resolve(fallback), duration))]);

export const proxy =
  <T, Context>(decider: Decider<T, Context>, proxy: (result: T, context: Context) => T): Decider<T, Context> =>
  context =>
    proxy(decide(decider, context), context);

// // example for below
// const mouseForceD = cases({
//   seek: seek(_mouse, 5),
//   flee: flee(_mouse, 5),
//   ignore: _zero,
// });

// const mouseForce = decide(mouseForceD, "seek");

export const cases =
  <T, Context, Cases extends string>(
    values: Record<Cases, Decider<T, Context>>,
    key: Decider<Cases, Context>,
  ): Decider<T, Context> =>
  context => {
    const caseKey = decide(key, context);
    const caseDecider = values[caseKey];
    if (!caseDecider) throw new Error(`Case ${caseKey} not found in cases`);
    return decide(caseDecider, context);
  };

// /** Creates an attack effect Decider based on a power level */
// export const power(
//   power: number,
// ): Decider<Attack, TargetContext> => context => {
//     const { source, action } = context;
//     if (!(source instanceof MoveEntry)) throw new Error("power() can only be used with moves");

//     const { user, effects } = source;
//     const { category, type } = effects;

//     if (category === "Status") throw new Error("Status moves cannot have an attack effect");
//     const relevantStat = {
//       Physical: user.stats.attack,
//       Special: user.stats.specialAttack,
//     }[category];

//     return {
//       level: user.stats.level,
//       power,
//       stat: relevantStat.value(true),
//       type,

//       category,
//       critical: source.getCriticalMultiplier(),
//       stab: user.getSpecies().types.includes(type) ? config.moves.stabMultiplier : 1,
//       multitarget: action.params.targets.length > 1 ? config.moves.multitargetMultiplier : 1,
//       random: decide(config.moves.randomMultiplier, undefined),
//     };

//   };
