// https://en.wikipedia.org/wiki/CHIP-8

import { DeepPartial } from "../../../common.ts";

const Magic = {
  default: {
    length: {
      memory: 0x1000,
      stack: 0x10,
      registers: 0x10,
    },
    speed: {
      timerHz: 60,
      clockHz: 500,
    },
    screen: {
      width: 0x40,
      height: 0x20,
    },
    init: {
      programStart: 0x200,
      fontStart: 0x050,
    },
  },
};

type Config = DeepPartial<typeof Magic.default>;

const nybble = (number: number, offset: number) => (number >> (4 * offset)) & 0xf;

export default class CHIP8 {
  memory;
  stack;
  stackDepth = 0;
  registers;
  address = 0; // 12-bit
  program;

  delay = 0;
  sound = 0;
  timer;
  clock;

  screen;

  constructor(rom: Uint8Array, config?: Config) {
    // TODO: Check config for integers
    // TODO: Deep merge config into Magic.default

    this.memory = new Uint8Array(config?.length?.memory ?? Magic.default.length.memory);
    const pc = config?.init?.programStart ?? Magic.default.init.programStart;
    this.memory.set(rom, pc);
    this.program = pc;

    this.stack = new Uint16Array(config?.length?.stack ?? Magic.default.length.stack);
    this.registers = new Uint8Array(config?.length?.registers ?? Magic.default.length.registers);

    const width = config?.screen?.width ?? Magic.default.screen.width;
    const height = config?.screen?.height ?? Magic.default.screen.height;
    this.screen = new Uint8Array(width * height);

    const timerHz = config?.speed?.timerHz ?? Magic.default.speed.timerHz;
    this.timer = setInterval(() => {
      if (this.delay > 0) this.delay -= 1;
      if (this.sound > 0) this.sound -= 1;
    }, 1000 / timerHz);

    const clockHz = config?.speed?.clockHz ?? Magic.default.speed.clockHz;
    this.clock = setInterval(() => this.tick(), 1000 / clockHz);
  }

  tick() {
    const high = this.memory[this.program];
    const low = this.memory[this.program + 1];
    const instruction = (high << 8) | low;
    const opFamily = nybble(instruction, 3);
    this.program += 2;
    this.instructionDispatch[opFamily](instruction);
  }

  private instructionDispatch = [
    (instruction: number) => this.machineCode(instruction & 0xfff),
    (instruction: number) => this.jump(instruction & 0xfff),
    (instruction: number) => this.call(instruction & 0xfff),
    (instruction: number) => this.skipEq(nybble(instruction, 2), instruction & 0x00ff),
    (instruction: number) => this.skipNeq(nybble(instruction, 2), instruction & 0x00ff),
    (instruction: number) => this.skipReq(nybble(instruction, 2), nybble(instruction, 1), nybble(instruction, 0)),
    (instruction: number) => this.set(nybble(instruction, 2), instruction & 0x00ff),
    (instruction: number) => this.add(nybble(instruction, 2), instruction & 0x00ff),
    (instruction: number) => this.regOp(nybble(instruction, 2), nybble(instruction, 1), nybble(instruction, 0)),
    (instruction: number) => this.skipRneq(nybble(instruction, 2), nybble(instruction, 1), nybble(instruction, 0)),
    (instruction: number) => this.setAddr(instruction & 0xfff),
    (instruction: number) => this.jump(instruction & 0xfff, 0),
    (instruction: number) => this.rand(nybble(instruction, 2), instruction & 0x00ff),
    (instruction: number) => this.draw(nybble(instruction, 2), nybble(instruction, 1), nybble(instruction, 0)),
    (instruction: number) => this.keyCheck(nybble(instruction, 2), instruction & 0x00ff),
    (instruction: number) => this.f(nybble(instruction, 2), instruction & 0x00ff),
  ];

  private machineCode(address: number) {}

  private jump(address: number, registerOffset?: number) {
    this.program = address;
    if (registerOffset !== undefined) this.program += this.registers[registerOffset];
  }

  private call(address: number) {
    this.stack[this.stackDepth] = this.program;
    this.stackDepth++;
    if (this.stackDepth > this.stack.length) throw new Error("Stack overflow");
    this.jump(address);
  }

  private skipEq(register: number, byte: number) {
    if (this.registers[register] === byte) this.program += 2;
  }

  private skipNeq(register: number, byte: number) {
    if (this.registers[register] !== byte) this.program += 2;
  }

  private skipReq(register1: number, register2: number, extra: number) {
    if (this.registers[register1] === this.registers[register2]) this.program += 2;
  }

  private set(register: number, byte: number) {
    this.registers[register] = byte;
  }

  private add(register: number, byte: number) {
    this.registers[register] += byte;
  }

  private regOpDispatch = [
    (r1: number, r2: number) => (this.registers[r1] = this.registers[r2]),
    (r1: number, r2: number) => (this.registers[r1] |= this.registers[r2]),
    (r1: number, r2: number) => (this.registers[r1] &= this.registers[r2]),
    (r1: number, r2: number) => (this.registers[r1] ^= this.registers[r2]),
    (r1: number, r2: number) => (this.registers[r1] += this.registers[r2]),
    (r1: number, r2: number) => (this.registers[r1] -= this.registers[r2]),
    (r1: number, r2: number) => {},
    (r1: number, r2: number) => {},
    (r1: number, r2: number) => {throw new Error("Bad instruction")},
    (r1: number, r2: number) => {throw new Error("Bad instruction")}
    (r1: number, r2: number) => {},
    (r1: number, r2: number) => {throw new Error("Bad instruction")},
    (r1: number, r2: number) => {throw new Error("Bad instruction")},
    (r1: number, r2: number) => {throw new Error("Bad instruction")},
    (r1: number, r2: number) => {throw new Error("Bad instruction")},
    (r1: number, r2: number) => {throw new Error("Bad instruction")},

  ];
  private regOp(register1: number, register2: number, op: number) {
    const v1 = this.registers[register1];
    const v2 = this.registers[register2];
    this.regOpDispatch[op](v1, v2);
  }

  private skipRneq(register1: number, register2: number, extra: number) {
    if (this.registers[register1] !== this.registers[register2]) this.program += 2;
  }

  private setAddr(address: number) {
    this.address = address;
  }
  private rand(register: number, byte: number) {}
  private draw(registerX: number, registerY: number, nybble: number) {}
  private keyCheck(register: number, extra: number) {}
  private f(register: number, extra: number) {}

  [Symbol.dispose] = () => {
    if (this.timer > 0) clearInterval(this.timer);
    if (this.clock > 0) clearInterval(this.clock);
  };
}
