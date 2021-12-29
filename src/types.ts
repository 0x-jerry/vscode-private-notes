export interface UserConfiguration {
  /**
   * @default ["**\/*.md"]
   */
  include: string[];

  /**
   * @default ['.encrypt.json']
   */
  exclude: string[];
}
