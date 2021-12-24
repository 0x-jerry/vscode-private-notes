export interface UserConfiguration {
  /**
   * Do not encrypt those files. Support regexp pattern.
   *
   * example: exclude `.jpg` files.
   *
   * "exclude": ["\\.jpg$"]
   */
  exclude: string[];
}
