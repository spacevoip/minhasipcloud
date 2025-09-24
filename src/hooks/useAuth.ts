import { useState, useEffect } from 'react';
import { unifiedAuthService, type UnifiedUser } from '@/lib/unifiedAuth';

export function useAuth() {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = unifiedAuthService.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          const currentUser = unifiedAuthService.getCurrentUser();
          setUser(currentUser);

          // Try to get fresh data in background
          const freshUser = await unifiedAuthService.getCurrentUserFromAPI();
          if (freshUser) {
            setUser(freshUser);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: any) => {
    setIsLoading(true);
    try {
      const result = await unifiedAuthService.login(credentials);
      if (result.success && result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await unifiedAuthService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    if (!isAuthenticated) return;
    
    try {
      const freshUser = await unifiedAuthService.getCurrentUserFromAPI();
      if (freshUser) {
        setUser(freshUser);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refresh,
    isAdmin: () => unifiedAuthService.isAdmin(),
    isAgent: () => unifiedAuthService.isAgent(),
    hasRole: (role: string | string[]) => unifiedAuthService.hasRole(role as any),
    canPerformCRUD: () => unifiedAuthService.canPerformCRUD()
  };
}
