import type { OneOf } from "../../common.ts";

export const Magic = {
  coreFreq: 440,
  corePitch: 48,

  stepsPerOctave: 12,
  freqFactorPerOctave: 2,
};
type Magic = typeof Magic;

// TODO: probably don't use this, use Magic values directly
const halfStepFactor = Math.pow(Magic.freqFactorPerOctave, 1 / Magic.stepsPerOctave);

type ToneFrom = OneOf<{ frequency: Frequency } | { pitch: Pitch } | { name: NoteName }>;

class Tone {
  private constructor(
    public frequency: number = 440,
    private magic = Magic,
  ) {}
  public static from(from: ToneFrom): Tone {
    if (from.frequency !== undefined) return new Tone(from.frequency);

    const tone = new Tone(0, Magic);
    if (from.pitch !== undefined) tone.pitch = from.pitch;
    else if (from.name !== undefined) tone.name = from.name;
    else throw new Error("Invalid ToneFrom");
    return tone;
  }

  public get pitch() {
    return this.magic.corePitch + Math.log(this.frequency / this.magic.coreFreq) / Math.log(halfStepFactor);
  }

  public set pitch(from: Pitch) {
    this.frequency = this.magic.coreFreq * Math.pow(halfStepFactor, from - this.magic.corePitch);
  }

  public get name() {
    return "A0" as NoteName;
  }
  public set name(from: NoteName) {}

  play(overtones: number[]) {}
}

// type ScaleFrom = OneOf<{ intervals: number[] } | { name: string }>;

// class Scale {
//   private constructor(
//     public root: Tone,
//     public intervals: number[],
//   ) {}
//   public static from(from: ScaleFrom): Scale {}

//   tone(octave: number, degree: number): Tone {}

//   halfSteps(degree: number): number {}

//   name() {
//     return "";
//   }
// }

type Frequency = number;
type Pitch = number;

declare const pitchNameBrand: unique symbol;
export type NoteName = string & { readonly [pitchNameBrand]: true };
export const pitchNameRegex = /^[A-G][#b]?\d$/;
export const isValidPitchName = (name: string): name is NoteName => pitchNameRegex.test(name);
