// Simple in-memory user store for demo purposes
export interface MockUser {
  name: string;
  email: string;
  password: string;
}

export const mockUsers: MockUser[] = [
  {
    name: "Demo User",
    email: "demo@test.com",
    password: "password123",
  },
];
