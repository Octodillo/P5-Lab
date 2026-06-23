import { Species } from "../../../../Codemon/src/mod.ts";
import { Bulbasaur } from "../../../../Codemon/codex/pokemon/species/bulbasaur.ts";
import { p5 } from "../../../types/p5-global.d.ts";
import { numberInput } from "../../controls.ts";
import { receive, Sketch } from "../../lab.ts";
import { loadSprite } from "./util.ts";

const Controller = [numberInput("ndid", 1, "National Dex ID", "National Dex ID")];

interface CodexDisplay {
  species: Species;
  image: {
    front: p5.Image;
    back: p5.Image;
  };
}

class Pokedex extends Sketch<typeof Controller> {
  override schema = Controller;
  private current?: CodexDisplay;

  override setup(): void {
    this.controls.subscribe("ndid", () => {
      this.current = {
        species: Bulbasaur,
        image: {
          front: loadSprite(this.p5, this.controls.values.ndid, "front"),
          back: loadSprite(this.p5, this.controls.values.ndid, "back"),
        },
      };
      this.ndidChanged = true;
    });
  }

  override update(): void {}

  private ndidChanged = false;
  override redraw(): boolean {
    return this.ndidChanged;
  }

  override draw(): void {
    if (!this.current) return;
    this.p5.translate(this.p5.width / 2, this.p5.height / 2);
    this.p5.image(this.current.image.front, 0, 0);
  }
}

receive(Pokedex);
