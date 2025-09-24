export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export function getStatusColor(status: UserStatus): string {
  switch (status) {
    case 'active':
      return '#16a34a'; // green-600
    case 'inactive':
      return '#f59e0b'; // amber-500
    case 'suspended':
      return '#ef4444'; // red-500
    case 'pending':
    default:
      return '#6b7280'; // gray-500
  }
}

export function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'inactive':
      return 'Inativo';
    case 'suspended':
      return 'Suspenso';
    case 'pending':
    default:
      return 'Pendente';
  }
}
