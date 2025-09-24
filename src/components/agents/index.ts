// Code splitting exports for agent components
import { lazy } from 'react';

// Lazy load components for better bundle optimization
export const AgentList = lazy(() => import('./AgentList').then(module => ({ default: module.AgentList })));
export const AgentModal = lazy(() => import('./AgentModal').then(module => ({ default: module.AgentModal })));
export const AgentPanel = lazy(() => import('./AgentPanel').then(module => ({ default: module.AgentPanel })));

// Direct exports for components that need immediate loading
export { AgentList as AgentListDirect } from './AgentList';
export { AgentModal as AgentModalDirect } from './AgentModal';
export { AgentPanel as AgentPanelDirect } from './AgentPanel';
