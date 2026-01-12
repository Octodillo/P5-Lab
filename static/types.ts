// TypeScript definitions for better IntelliSense in static files

// API Response types
export interface SketchInfo {
  name: string;
  path: string;
}

export interface VersionInfo {
  deno: string;
}

// DOM element types for sketch containers
declare global {
  interface HTMLElement {
    // p5 sketch container
    sketch?: object;
  }
}

// Fetch API extensions for our endpoints
export interface SketchesAPI {
  "/api/sketches": string[];
  "/api/version": VersionInfo;
}

export type APIEndpoint = keyof SketchesAPI;
export type APIResponse<T extends APIEndpoint> = SketchesAPI[T];
