'use client';

import React, { useState } from 'react';
import { Phone, PhoneOff, PhoneForwarded, Clock } from 'lucide-react';
import { ActiveCall } from '@/types';

interface ActiveCallRowProps {
  call: ActiveCall;
  onHangup: (callId: string) => void;
  onTransfer: (call: ActiveCall) => void;
}

const ActiveCallRow: React.FC<ActiveCallRowProps> = ({ call, onHangup, onTransfer }) => {
  const [isHangupLoading, setIsHangupLoading] = useState(false);

  const handleHangup = async () => {
    setIsHangupLoading(true);
    try {
      await onHangup(call.id);
    } finally {
      setIsHangupLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ringing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'up':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'busy':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-150">
      {/* Ramal */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-8 w-8">
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Phone className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">{call.extension}</div>
            <div className="text-sm text-gray-500">Ramal</div>
          </div>
        </div>
      </td>

      {/* De */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{call.from}</div>
        <div className="text-sm text-gray-500">Origem</div>
      </td>

      {/* Para */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{call.to}</div>
        <div className="text-sm text-gray-500">Destino</div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(call.status)}`}>
          {call.status}
        </span>
      </td>

      {/* Duração */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center text-sm text-gray-900">
          <Clock className="h-4 w-4 text-gray-400 mr-1" />
          {formatDuration(call.duration)}
        </div>
      </td>

      {/* Ações */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          {/* Botão Transferir */}
          <button
            onClick={() => onTransfer(call)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
          >
            <PhoneForwarded className="h-3 w-3 mr-1" />
            Transferir
          </button>

          {/* Botão Desligar */}
          <button
            onClick={handleHangup}
            disabled={isHangupLoading}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isHangupLoading ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-700 mr-1"></div>
            ) : (
              <PhoneOff className="h-3 w-3 mr-1" />
            )}
            Desligar
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ActiveCallRow;
