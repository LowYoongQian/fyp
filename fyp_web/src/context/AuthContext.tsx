import React, { createContext, useState, useEffect, useContext } from 'react';
import { apiService } from '../services/api';

interface UserSession {
  user_id: number;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Restore session on mount
    const savedToken = sessionStorage.getItem('auth_token');
    const savedUser = sessionStorage.getItem('auth_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiService.login(email, password);
      // Backend returns: { access_token, token_type, role, user_id }
      const sessionUser: UserSession = {
        user_id: data.user_id,
        email: email,
        role: data.role as 'student' | 'lecturer' | 'admin',
      };

      sessionStorage.setItem('auth_token', data.access_token);
      sessionStorage.setItem('auth_user', JSON.stringify(sessionUser));

      setToken(data.access_token);
      setUser(sessionUser);
      setLoading(false);
      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
