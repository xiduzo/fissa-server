export interface Room {
  id?: string;
  pin: string;
  accessToken: string;
  createdBy: string;
  currentIndex: number;
  createdAt: string;
  expectedEndTime?: string;
}
