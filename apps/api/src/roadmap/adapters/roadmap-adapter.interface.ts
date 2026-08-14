import { NormalizedRoadmap } from '../roadmap.types';

export interface RoadmapSourceAdapter {
  /**
   * Determines if this adapter can handle the given input (URL, file content, etc.)
   */
  canHandle(input: string): boolean;

  /**
   * Fetches, extracts, and normalizes the raw roadmap data into the standard DevOS structure.
   */
  normalize(input: string): Promise<NormalizedRoadmap>;
}
