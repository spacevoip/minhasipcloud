'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { PhoneForwarded, X, Search } from 'lucide-react';
import { ActiveCall } from '@/types';

interface Extension {
  extension: string;
  nome: string;
  status: 'online' | 'offline';
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: ActiveCall | null;
  onConfirm: (extension: string) => void;
}

const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  call,
  onConfirm
}) => {
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock data - substituir por dados reais
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Simular carregamento de extensões
      setTimeout(() => {
        setExtensions([
          { extension: '1001', nome: 'João Silva', status: 'online' },
          { extension: '1002', nome: 'Maria Santos', status: 'online' },
          { extension: '1003', nome: 'Pedro Costa', status: 'offline' },
          { extension: '1004', nome: 'Ana Oliveira', status: 'online' },
          { extension: '1005', nome: 'Carlos Lima', status: 'offline' },
        ]);
        setLoading(false);
      }, 500);
    }
  }, [isOpen]);

  const filteredExtensions = extensions.filter(ext => 
    ext.extension.includes(searchQuery) || 
    ext.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = () => {
    if (selectedExtension) {
      onConfirm(selectedExtension);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedExtension('');
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-xl transition-all">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <PhoneForwarded className="h-5 w-5 text-white" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-medium text-white">
                    Transferir Chamada
                  </Dialog.Title>
                  <p className="text-sm text-white/80">
                    {call?.extension} → {call?.to}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Buscar ramal ou nome..."
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Extensions List */}
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <div className="max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-600">Carregando...</span>
                  </div>
                ) : filteredExtensions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Nenhum ramal encontrado</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredExtensions.map((ext) => {
                      const isSelected = selectedExtension === ext.extension;
                      const isDisabled = ext.status === 'offline' || ext.extension === call?.extension;
                      
                      return (
                        <button
                          key={ext.extension}
                          onClick={() => !isDisabled && setSelectedExtension(ext.extension)}
                          disabled={isDisabled}
                          className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                            isSelected 
                              ? 'bg-blue-50 border-l-4 border-blue-500' 
                              : isDisabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-white'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${
                              ext.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`text-sm font-medium ${
                              isSelected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {ext.nome}
                            </p>
                            <p className={`text-xs ${
                              isSelected ? 'text-blue-600' : 'text-gray-500'
                            }`}>
                              Ramal: {ext.extension} • {ext.status === 'online' ? 'Online' : 'Offline'}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="flex-shrink-0">
                              <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleConfirm}
                disabled={!selectedExtension}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedExtension
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Transferir
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default TransferModal;
