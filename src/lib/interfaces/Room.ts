export interface Room {
  id?: string;
  pin: string;
  accessToken: string;
  createdBy: string;
  currentIndex: number;
  expectedEndTime?: string;
}
