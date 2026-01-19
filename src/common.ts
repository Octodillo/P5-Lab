export interface SketchMeta {
  name: string;
  entry: string;
  icon?: string;
  description?: string;
  feature?: boolean;
}

export type SketchIndex = SketchMeta[];
