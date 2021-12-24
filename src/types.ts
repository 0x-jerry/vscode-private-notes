export interface UserConfiguration {
  /**
   * Do not encrypt those files. Support glob pattern.
   *
   * example: exclude `.jpg` files.
   *
   * "exclude": ["**\/*.jpg"]
   */
  exclude: string[];
}
