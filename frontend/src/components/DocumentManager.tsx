import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import type { DocumentInfo } from '../services/api';

interface DocumentManagerProps {
  onClose: () => void;
}

export function DocumentManager({ onClose }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll for document statuses if any are in 'processing' state
  useEffect(() => {
    fetchDocs();
  }, []);

  useEffect(() => {
    const hasProcessing = documents.some(doc => doc.status === 'processing');
    if (hasProcessing) {
      const interval = setInterval(() => {
        fetchDocs(true); // silent fetch without main loading spinner
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [documents]);

  const fetchDocs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getDocuments();
      setDocuments(data);
      setError(null);
    } catch (err: any) {
      setError('Failed to fetch documents. Make sure the backend server is running.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]!);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]!);
    }
  };

  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext || '')) {
      setError('Only PDF, DOCX, and TXT files are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit.');
      return;
    }

    setError(null);
    setUploadingFile(file);
    setUploadProgress(0);

    try {
      await api.uploadDocument(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      fetchDocs(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploadingFile(null);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc._id !== id));
    } catch (err: any) {
      setError('Failed to delete document.');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in font-sans">
      <div className="w-full max-w-2xl bg-canvas rounded-xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-border-light">
        
        {/* Header */}
        <div className="p-6 border-b border-border-light flex items-center justify-between bg-canvas">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pale-blue rounded-lg flex items-center justify-center border border-border-light">
              <FileText size={24} className="text-action-blue" />
            </div>
            <div>
              <h3 className="font-semibold text-[24px] text-ink font-cohere-display tracking-tight">Document Knowledge Base</h3>
              <p className="text-[14px] text-muted">Manage files uploaded to DocuMind-AI</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-soft-stone rounded-full transition-colors text-muted hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8 flex-1 bg-canvas">
          {error && (
            <div className="p-4 bg-error/5 border border-error/20 rounded-md flex items-start gap-3 text-error text-[14px] font-medium">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
              isDragging 
                ? 'border-action-blue bg-pale-blue scale-[0.99]' 
                : 'border-slate hover:border-cohere-black bg-soft-stone/30 hover:bg-soft-stone'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              accept=".pdf,.docx,.txt"
            />
            
            {uploadingFile ? (
              <div className="w-full text-center space-y-4">
                <RefreshCw size={28} className="text-action-blue animate-spin mx-auto" />
                <p className="text-[16px] font-medium text-ink">Uploading {uploadingFile.name}...</p>
                <div className="w-full max-w-xs bg-border-light rounded-full h-2 mx-auto overflow-hidden">
                  <div 
                    className="bg-action-blue h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[12px] text-muted font-mono">{uploadProgress}% UPLOADED</span>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-14 h-14 bg-canvas rounded-xl flex items-center justify-center mx-auto border border-border-light shadow-sm">
                  <Upload size={24} className="text-ink" />
                </div>
                <p className="text-[16px] font-medium text-ink">Drag & drop files here, or <span className="text-action-blue hover:underline">browse</span></p>
                <p className="text-[14px] text-muted">Supports PDF, DOCX, TXT up to 10MB</p>
              </div>
            )}
          </div>

          {/* Document List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[12px] font-bold text-slate uppercase tracking-widest font-mono">Uploaded Documents</span>
              <button 
                onClick={() => fetchDocs(false)} 
                className="text-[14px] text-action-blue flex items-center gap-1 hover:underline font-medium"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {loading && documents.length === 0 ? (
              <div className="text-center py-10">
                <RefreshCw size={24} className="text-slate animate-spin mx-auto" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 bg-canvas border border-border-light rounded-lg text-muted text-[14px]">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc._id} className="flex items-center justify-between p-4 bg-canvas border border-border-light rounded-lg hover:border-cohere-black hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2.5 bg-soft-stone rounded-md border border-border-light flex items-center justify-center text-ink">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[16px] font-medium text-ink truncate pr-2">{doc.fileName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[14px] text-muted">{formatBytes(doc.fileSize)}</span>
                          <span className="text-border-light text-[10px]">•</span>
                          <span className="text-[12px] text-muted font-mono uppercase tracking-wide">{doc.fileType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Status Badges */}
                      {doc.status === 'processing' && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-mono font-medium bg-soft-stone text-ink border border-border-light uppercase">
                          <RefreshCw size={12} className="animate-spin" />
                          Processing
                        </span>
                      )}
                      {doc.status === 'indexed' && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-mono font-medium bg-pale-green text-deep-green border border-[#c1e8b5] uppercase">
                          <CheckCircle size={12} />
                          Indexed
                        </span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-mono font-medium bg-error/5 text-error border border-error/20 uppercase">
                          <AlertCircle size={12} />
                          Failed
                        </span>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(doc._id)}
                        className="p-2.5 hover:bg-error/10 text-muted hover:text-error rounded-md transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-light bg-soft-stone text-center text-[12px] text-muted">
          DocuMind-AI uses secure local storage and encrypted cloud API pipelines.
        </div>

      </div>
    </div>
  );
}
