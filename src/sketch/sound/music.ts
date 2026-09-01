import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";

const Magic = {
  coreFreq: 440,
  corePitch: 48,
  halfStepFactor: Math.pow(2, -1 / 12),
} as const;

const frequency = (pitch: number | PitchName) => Magic.coreFreq * Math.pow(2, pitch - Magic.corePitch);
Deno.test("Pitch to Frequency", () => {
  assert(frequency(Magic.corePitch) === Magic.coreFreq);
});

declare const pitchNameBrand: unique symbol;
export type PitchName = string & { readonly [pitchNameBrand]: true };
const pitchNameRegex = /^[A-G][#b]?\d$/;
const isValidPitchName = (name: string): name is PitchName => pitchNameRegex.test(name);
