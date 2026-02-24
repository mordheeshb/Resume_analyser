// Simple in-memory user store for demo purposes
export interface MockUser {
  name: string;
  email: string;
  password: string;
}

export const mockUsers: MockUser[] = [
  {
    name: "Mothy",
    email: "mothy@gmail.com",
    password: "12345678",
  },
];
