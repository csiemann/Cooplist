import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
}

const savedUser = localStorage.getItem('cooplist_user');
const initialUser = savedUser ? (JSON.parse(savedUser) as User) : null;

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  token: localStorage.getItem('cooplist_token'),
  setAuth: (user, token) => {
    if (token) {
      localStorage.setItem('cooplist_token', token);
      if (user) {
        localStorage.setItem('cooplist_user', JSON.stringify(user));
      }
    } else {
      localStorage.removeItem('cooplist_token');
      localStorage.removeItem('cooplist_user');
    }
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('cooplist_token');
    localStorage.removeItem('cooplist_user');
    set({ user: null, token: null });
  },
}));
