export interface Room {
  id?: string;
  playlistId: string;
  pin: string;
  accessToken: string;
  createdBy: string;
  currentIndex: number;
  expectedEndTime?: string;
}
