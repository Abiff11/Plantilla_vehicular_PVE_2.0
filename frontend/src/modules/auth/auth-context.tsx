import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { api, setUnauthorizedHandler } from '../../lib/api';
import { connectSocket, disconnectSocket, resetSocketReconnectAttempts } from '../../lib/socket';
import type { AuthResponse } from '../../types';
import { clearLegacyAuthStorage, clearStoredAccessToken } from './auth-storage';

type AuthState = AuthResponse | null;

type AuthContextValue = {
  session: AuthState;
  isHydrating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  logoutWithApi: () => Promise<void>;
};

const EMPTY_ACCESS_TOKEN = '';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthState>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSession(null);
      clearStoredAccessToken();
      clearLegacyAuthStorage();
      disconnectSocket();
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    const bootstrapSession = async () => {
      clearStoredAccessToken();
      clearLegacyAuthStorage();

      try {
        const user = await api.getCurrentUser(EMPTY_ACCESS_TOKEN);
        setSession({ accessToken: EMPTY_ACCESS_TOKEN, user });
        connectSocket();
      } catch {
        setSession(null);
      } finally {
        setIsHydrating(false);
      }
    };

    void bootstrapSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isHydrating,
      async login(email, password) {
        const response = await api.login(email, password);
        setSession({ accessToken: EMPTY_ACCESS_TOKEN, user: response.user });
        resetSocketReconnectAttempts();
        connectSocket();
      },
      logout() {
        setSession(null);
        clearStoredAccessToken();
        clearLegacyAuthStorage();
        disconnectSocket();
      },
      async logoutWithApi() {
        try {
          await api.logout(EMPTY_ACCESS_TOKEN);
        } catch {
        } finally {
          setSession(null);
          clearStoredAccessToken();
          clearLegacyAuthStorage();
          disconnectSocket();
        }
      },
    }),
    [isHydrating, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
