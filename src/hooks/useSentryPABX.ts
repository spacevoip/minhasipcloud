import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface PABXUser {
  id: string;
  email: string;
  role: string;
  accountcode?: string;
}

interface PABXContext {
  activeCallsCount?: number;
  onlineAgentsCount?: number;
  userRole?: string;
  currentPage?: string;
}

export const useSentryPABX = () => {
  // Configurar contexto do usuário PABX
  const setUserContext = (user: PABXUser) => {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
      accountcode: user.accountcode,
    });
    
    Sentry.setTag("user.role", user.role);
    Sentry.setTag("user.accountcode", user.accountcode || "unknown");
  };

  // Configurar contexto específico do PABX
  const setPABXContext = (context: PABXContext) => {
    Sentry.setContext("pabx", {
      activeCallsCount: context.activeCallsCount,
      onlineAgentsCount: context.onlineAgentsCount,
      userRole: context.userRole,
      currentPage: context.currentPage,
      timestamp: new Date().toISOString(),
    });
  };

  // Capturar erro de chamada ativa
  const captureActiveCallError = (error: Error, callData?: any) => {
    Sentry.withScope((scope) => {
      scope.setTag("error.type", "active_call");
      scope.setContext("call_data", callData);
      Sentry.captureException(error);
    });
  };

  // Capturar erro de status de ramal
  const captureExtensionStatusError = (error: Error, extension?: string) => {
    Sentry.withScope((scope) => {
      scope.setTag("error.type", "extension_status");
      scope.setTag("extension", extension || "unknown");
      Sentry.captureException(error);
    });
  };

  // Capturar erro de autenticação
  const captureAuthError = (error: Error, authType?: string) => {
    Sentry.withScope((scope) => {
      scope.setTag("error.type", "authentication");
      scope.setTag("auth.type", authType || "unknown");
      Sentry.captureException(error);
    });
  };

  // Capturar erro de API
  const captureAPIError = (error: Error, endpoint?: string, method?: string) => {
    Sentry.withScope((scope) => {
      scope.setTag("error.type", "api");
      scope.setTag("api.endpoint", endpoint || "unknown");
      scope.setTag("api.method", method || "unknown");
      Sentry.captureException(error);
    });
  };

  // Adicionar breadcrumb para ações importantes
  const addPABXBreadcrumb = (message: string, category: string, data?: any) => {
    Sentry.addBreadcrumb({
      message,
      category: `pabx.${category}`,
      level: "info",
      data,
      timestamp: Date.now() / 1000,
    });
  };

  // Performance monitoring para operações críticas
  const startTransaction = (name: string, op: string) => {
    return Sentry.startTransaction({
      name: `pabx.${name}`,
      op: `pabx.${op}`,
      tags: {
        system: "pabx",
      },
    });
  };

  return {
    setUserContext,
    setPABXContext,
    captureActiveCallError,
    captureExtensionStatusError,
    captureAuthError,
    captureAPIError,
    addPABXBreadcrumb,
    startTransaction,
  };
};

// Hook para monitoramento automático de páginas
export const useSentryPageTracking = (pageName: string) => {
  const { addPABXBreadcrumb } = useSentryPABX();

  useEffect(() => {
    addPABXBreadcrumb(`Navegou para ${pageName}`, "navigation", {
      page: pageName,
      timestamp: new Date().toISOString(),
    });

    // Definir contexto da página atual
    Sentry.setTag("page.current", pageName);
  }, [pageName, addPABXBreadcrumb]);
};
