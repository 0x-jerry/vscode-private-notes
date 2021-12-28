export interface UserConfiguration {
  /**
   * @default ["**\/*.md"]
   */
  include: string[];

  /**
   * @default []
   */
  exclude: string[];
}
