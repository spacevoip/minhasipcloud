'use client';

import React from 'react';
import { Phone, PhoneCall, Clock, Users } from 'lucide-react';
import { ActiveCall } from '@/types';

interface CallStatsProps {
  calls: ActiveCall[];
  loading: boolean;
}

const CallStats: React.FC<CallStatsProps> = ({ calls, loading }) => {
  const totalCalls = calls.length;
  const ringingCalls = calls.filter(call => call.status.toLowerCase() === 'ringing').length;
  const activeCalls = calls.filter(call => call.status.toLowerCase() === 'up').length;
  const avgDuration = calls.length > 0 
    ? Math.round(calls.reduce((sum, call) => sum + call.duration, 0) / calls.length)
    : 0;

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const stats = [
    {
      name: 'Total de Chamadas',
      value: loading ? '...' : totalCalls.toString(),
      icon: Phone,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Chamadas Tocando',
      value: loading ? '...' : ringingCalls.toString(),
      icon: PhoneCall,
      color: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      name: 'Chamadas Ativas',
      value: loading ? '...' : activeCalls.toString(),
      icon: Users,
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Duração Média',
      value: loading ? '...' : formatDuration(avgDuration),
      icon: Clock,
      color: 'bg-gradient-to-r from-purple-500 to-purple-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {stats.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <div key={stat.name} className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <dt>
              <div className={`absolute ${stat.bgColor} rounded-md p-3`}>
                <IconComponent className={`h-6 w-6 ${stat.textColor}`} aria-hidden="true" />
              </div>
              <p className="ml-16 text-sm font-medium text-gray-500 truncate">{stat.name}</p>
            </dt>
            <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </dd>
            <div className={`absolute bottom-0 left-0 w-full h-1 ${stat.color}`}></div>
          </div>
        );
      })}
    </div>
  );
};

export default CallStats;
