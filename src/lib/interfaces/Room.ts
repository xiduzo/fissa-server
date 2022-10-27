export interface Room {
  id?: string;
  pin: string;
  accessToken: string;
  refreshToken: string;
  createdBy: string;
  currentIndex: number;
  lastPlayedIndex: number;
  createdAt: string;
  expectedEndTime?: string;
}
