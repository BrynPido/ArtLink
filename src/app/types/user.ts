export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  profileImage?: string;
  role?: 'user' | 'admin'; // Role for user/admin distinction
  isAdmin?: boolean; // Helper flag for admin status
}