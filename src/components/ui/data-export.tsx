'use client';

import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';

interface ExportOption {
  format: 'csv' | 'excel' | 'pdf';
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface DataExportProps {
  data: any[];
  filename?: string;
  title?: string;
  onExport?: (format: string, data: any[]) => Promise<void>;
  className?: string;
}

export function DataExport({
  data,
  filename = 'export',
  title = 'Exportar Dados',
  onExport,
  className = ''
}: DataExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const exportOptions: ExportOption[] = [
    {
      format: 'csv',
      label: 'CSV',
      icon: <FileText size={16} />,
      description: 'Arquivo de texto separado por vírgulas'
    },
    {
      format: 'excel',
      label: 'Excel',
      icon: <FileSpreadsheet size={16} />,
      description: 'Planilha do Microsoft Excel'
    },
    {
      format: 'pdf',
      label: 'PDF',
      icon: <FileText size={16} />,
      description: 'Documento PDF formatado'
    }
  ];

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);
    setShowOptions(false);

    try {
      if (onExport) {
        await onExport(format, data);
      } else {
        // Implementação padrão de exportação
        await defaultExport(format, data, filename);
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const defaultExport = async (format: string, data: any[], filename: string) => {
    // Simular delay de exportação
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    switch (format) {
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'excel':
        exportToExcel(data, filename);
        break;
      case 'pdf':
        exportToPDF(data, filename);
        break;
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  const exportToExcel = (data: any[], filename: string) => {
    if (!data.length) return;

    // Importar XLSX dinamicamente
    import('xlsx').then((XLSX) => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
      
      // Configurar larguras das colunas
      const colWidths = Object.keys(data[0]).map(() => ({ wch: 20 }));
      worksheet['!cols'] = colWidths;
      
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    }).catch((error) => {
      console.error('Erro ao carregar biblioteca XLSX:', error);
      alert('Erro ao exportar para Excel. Tente novamente.');
    });
  };

  const exportToPDF = (data: any[], filename: string) => {
    // Simulação de exportação PDF
    console.log('Exportando para PDF:', { data, filename });
    alert(`Arquivo ${filename}.pdf seria baixado aqui`);
  };

  if (!data.length) {
    return null;
  }

  return (
    <div className={`data-export ${className}`} style={{ position: 'relative' }}>
      <button
        onClick={() => setShowOptions(!showOptions)}
        disabled={isExporting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0',
          backgroundColor: 'white',
          color: '#374151',
          fontSize: '0.875rem',
          fontWeight: '500',
          cursor: isExporting ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: isExporting ? 0.6 : 1
        }}
        onMouseEnter={(e) => {
          if (!isExporting) {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }
        }}
        onMouseLeave={(e) => {
          if (!isExporting) {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }
        }}
      >
        {isExporting ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Exportando...
          </>
        ) : (
          <>
            <Download size={16} />
            {title}
          </>
        )}
      </button>

      {/* Options Dropdown */}
      {showOptions && !isExporting && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e2e8f0',
          padding: '0.5rem',
          minWidth: '250px',
          zIndex: 50
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #f1f5f9',
            marginBottom: '0.5rem'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#1e293b'
            }}>
              Escolha o formato
            </h3>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '0.75rem',
              color: '#64748b'
            }}>
              {data.length} registro{data.length !== 1 ? 's' : ''} será{data.length !== 1 ? 'ão' : ''} exportado{data.length !== 1 ? 's' : ''}
            </p>
          </div>

          {exportOptions.map((option) => (
            <button
              key={option.format}
              onClick={() => handleExport(option.format)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#374151',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                borderRadius: '0.375rem',
                backgroundColor: '#f1f5f9',
                color: '#6366f1'
              }}>
                {option.icon}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '500',
                  color: '#1e293b'
                }}>
                  {option.label}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginTop: '0.125rem'
                }}>
                  {option.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Overlay to close dropdown */}
      {showOptions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40
          }}
          onClick={() => setShowOptions(false)}
        />
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
