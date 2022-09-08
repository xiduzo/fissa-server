export interface Room {
  id?: string;
  playlistId: string;
  pin: string;
  accessToken: string;
  currentIndex: number;
  /**
   * Unix timestamp
   */
  expectedEndTime: number;
}
