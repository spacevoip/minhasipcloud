import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Agent } from '../types';
import { agentsService } from '../lib/agentsService';
import { toast } from 'react-hot-toast';

export interface AgentsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  status?: string;
}

export interface AgentsResponse {
  agents: Agent[];
  total: number;
  page: number;
  totalPages: number;
}

// Query Keys
export const agentsKeys = {
  all: ['agents'] as const,
  lists: () => [...agentsKeys.all, 'list'] as const,
  list: (params: AgentsQueryParams) => [...agentsKeys.lists(), params] as const,
  details: () => [...agentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentsKeys.details(), id] as const,
};

// Hook para buscar agentes com paginação
export const useAgents = (params: AgentsQueryParams = {}) => {
  return useQuery({
    queryKey: agentsKeys.list(params),
    queryFn: async (): Promise<AgentsResponse> => {
      try {
        const response = await agentsService.getAgents(params);
        return response;
      } catch (error) {
        console.error('Error fetching agents:', error);
        throw error;
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time status
  });
};

// Hook para buscar um agente específico
export const useAgent = (id: string) => {
  return useQuery({
    queryKey: agentsKeys.detail(id),
    queryFn: () => agentsService.getAgent(id),
    enabled: !!id,
  });
};

// Hook para criar agente
export const useCreateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentData: Partial<Agent>) => agentsService.createAgent(agentData),
    onSuccess: (newAgent) => {
      // Invalidate and refetch agents list
      queryClient.invalidateQueries({ queryKey: agentsKeys.lists() });
      
      // Optionally add the new agent to existing cache
      queryClient.setQueryData(agentsKeys.detail(newAgent.id), newAgent);
      
      toast.success('Agente criado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error creating agent:', error);
      toast.error(error?.message || 'Erro ao criar agente');
    },
  });
};

// Hook para atualizar agente
export const useUpdateAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Agent> }) => 
      agentsService.updateAgent(id, data),
    onSuccess: (updatedAgent) => {
      // Update the specific agent in cache
      queryClient.setQueryData(agentsKeys.detail(updatedAgent.id), updatedAgent);
      
      // Update agent in lists cache
      queryClient.setQueriesData(
        { queryKey: agentsKeys.lists() },
        (oldData: AgentsResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            agents: oldData.agents.map(agent => 
              agent.id === updatedAgent.id ? updatedAgent : agent
            ),
          };
        }
      );
      
      toast.success('Agente atualizado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error updating agent:', error);
      toast.error(error?.message || 'Erro ao atualizar agente');
    },
  });
};

// Hook para excluir agente
export const useDeleteAgent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => agentsService.deleteAgent(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: agentsKeys.detail(deletedId) });
      
      // Update lists cache
      queryClient.setQueriesData(
        { queryKey: agentsKeys.lists() },
        (oldData: AgentsResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            agents: oldData.agents.filter(agent => agent.id !== deletedId),
            total: oldData.total - 1,
          };
        }
      );
      
      toast.success('Agente excluído com sucesso!');
    },
    onError: (error: any) => {
      console.error('Error deleting agent:', error);
      toast.error(error?.message || 'Erro ao excluir agente');
    },
  });
};

// Hook para atualizar campo específico do agente
export const useUpdateAgentField = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agent, field, value }: { agent: Agent; field: string; value: string }) => 
      agentsService.updateAgent(agent.id, { [field]: value }),
    onSuccess: (updatedAgent) => {
      // Update caches
      queryClient.setQueryData(agentsKeys.detail(updatedAgent.id), updatedAgent);
      
      queryClient.setQueriesData(
        { queryKey: agentsKeys.lists() },
        (oldData: AgentsResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            agents: oldData.agents.map(agent => 
              agent.id === updatedAgent.id ? updatedAgent : agent
            ),
          };
        }
      );
    },
    onError: (error: any) => {
      console.error('Error updating agent field:', error);
      throw error; // Re-throw to handle in component
    },
  });
};

// Hook para alternar status do agente
export const useToggleAgentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agent: Agent) => {
      const newStatus = agent.status === 'online' ? 'offline' : 'online';
      return agentsService.updateAgent(agent.id, { status: newStatus });
    },
    onSuccess: (updatedAgent) => {
      // Update caches
      queryClient.setQueryData(agentsKeys.detail(updatedAgent.id), updatedAgent);
      
      queryClient.setQueriesData(
        { queryKey: agentsKeys.lists() },
        (oldData: AgentsResponse | undefined) => {
          if (!oldData) return oldData;
          
          return {
            ...oldData,
            agents: oldData.agents.map(agent => 
              agent.id === updatedAgent.id ? updatedAgent : agent
            ),
          };
        }
      );
    },
    onError: (error: any) => {
      console.error('Error toggling agent status:', error);
      throw error;
    },
  });
};

// Hook para invalidar cache de agentes
export const useInvalidateAgents = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: agentsKeys.all });
  };
};
