import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, X, RefreshCw, AlertCircle, CheckCircle, RotateCcw, Folder as FolderIcon, FolderPlus } from 'lucide-react';
import { useDocumentsStore } from '../stores/useDocumentsStore';
import { useFoldersStore } from '../stores/useFoldersStore';
import { useDocumentPolling } from '../hooks/useDocumentPolling';
import { documentService } from '../services/documentService';

interface DocumentManagerProps {
  onClose: () => void;
}

export function DocumentManager({ onClose }: DocumentManagerProps) {
  const { documents, fetchDocuments, deleteDocument, retryDocument, updateDocumentFolder, isLoading, error: storeError } = useDocumentsStore();
  const { folders, fetchFolders, createFolder, deleteFolder, activeFolderId, setActiveFolder, isLoading: foldersLoading } = useFoldersStore();
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start polling if needed
  useDocumentPolling();

  useEffect(() => {
    fetchDocuments();
    fetchFolders();
  }, [fetchDocuments, fetchFolders]);

  const error = localError || storeError;

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
    // reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt', 'csv', 'xlsx', 'pptx'].includes(ext || '')) {
      setLocalError('Unsupported file format.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setLocalError('File size exceeds the 50MB limit.');
      return;
    }

    setLocalError(null);
    setUploadingFile(file);
    setUploadProgress(0);

    try {
      await documentService.uploadDocument(file, activeFolderId, (progressEvent) => {
        const percent = progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0;
        setUploadProgress(percent);
      });
      fetchDocuments();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to upload document.');
    } finally {
      setUploadingFile(null);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDocument(id);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to delete document.');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryDocument(id);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to retry document.');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in font-sans">
      <div className="w-full max-w-3xl bg-canvas rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-border-light">
        
        {/* Header */}
        <div className="p-6 border-b border-border-light flex items-center justify-between bg-canvas">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pale-blue rounded-lg flex items-center justify-center border border-border-light">
              <FileText size={24} className="text-action-blue" />
            </div>
            <div>
              <h3 className="font-semibold text-[24px] text-ink font-cohere-display tracking-tight">Document Knowledge Base</h3>
              <p className="text-[14px] text-muted">Manage files in your active workspace</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-soft-stone rounded-full transition-colors text-muted hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content with Sidebar */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Folders Sidebar */}
          <div className="w-48 bg-soft-stone/10 border-r border-border-light flex flex-col overflow-y-auto">
            <div className="p-4 flex items-center justify-between">
              <span className="text-[12px] font-bold text-slate uppercase tracking-widest font-mono">Folders</span>
              <button 
                onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                className="text-muted hover:text-ink transition-colors p-1 rounded hover:bg-black/5"
                title="Create Folder"
              >
                <FolderPlus size={16} />
              </button>
            </div>

            {isCreatingFolder && (
              <div className="px-3 pb-3">
                <input
                  type="text"
                  autoFocus
                  placeholder="Folder name..."
                  className="w-full bg-canvas border border-border-light rounded px-2 py-1.5 text-sm outline-none focus:border-action-blue"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newFolderName.trim()) {
                      try {
                        await createFolder(newFolderName.trim());
                        setNewFolderName('');
                        setIsCreatingFolder(false);
                      } catch (err: any) {
                        setLocalError(err.message || 'Failed to create folder');
                      }
                    } else if (e.key === 'Escape') {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  onBlur={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }}
                />
              </div>
            )}

            <div className="px-2 pb-4 space-y-0.5 flex-1">
              <button
                onClick={() => setActiveFolder(null)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${
                  activeFolderId === null 
                    ? 'bg-action-blue/10 text-action-blue font-medium' 
                    : 'text-muted hover:text-ink hover:bg-black/5'
                }`}
              >
                <FolderIcon size={16} className={activeFolderId === null ? 'text-action-blue' : ''} />
                <span className="truncate">All Documents</span>
              </button>

              {foldersLoading ? (
                <div className="p-4 text-center text-xs text-muted animate-pulse">Loading...</div>
              ) : (
                folders.map((folder) => (
                  <div key={folder._id} className="group relative">
                    <button
                      onClick={() => setActiveFolder(folder._id)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${
                        activeFolderId === folder._id 
                          ? 'bg-action-blue/10 text-action-blue font-medium' 
                          : 'text-muted hover:text-ink hover:bg-black/5'
                      }`}
                    >
                      <FolderIcon size={16} className={activeFolderId === folder._id ? 'text-action-blue' : ''} />
                      <span className="truncate">{folder.name}</span>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete folder "${folder.name}" and ALL its documents? This cannot be undone.`)) {
                          try {
                            await deleteFolder(folder._id);
                            fetchDocuments(); // refresh docs after cascade delete
                          } catch (err: any) {
                            setLocalError(err.message || 'Failed to delete folder');
                          }
                        }
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-error hover:bg-error/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Folder"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Documents Area */}
          <div className="p-8 overflow-y-auto space-y-8 flex-1 bg-canvas">
            {error && (
              <div className="p-4 bg-error/5 border border-error/20 rounded-md flex items-start gap-3 text-error text-[14px] font-medium">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
                <button onClick={() => setLocalError(null)} className="text-error opacity-70 hover:opacity-100">
                  <X size={16} />
                </button>
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
              accept=".pdf,.docx,.txt,.csv,.xlsx,.pptx"
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
                <p className="text-[14px] text-muted">Supports PDF, DOCX, TXT, CSV, XLSX, PPTX up to 50MB</p>
              </div>
            )}
          </div>

          {/* Document List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[12px] font-bold text-slate uppercase tracking-widest font-mono">Uploaded Documents</span>
              <button 
                onClick={() => fetchDocuments()} 
                className="text-[14px] text-action-blue flex items-center gap-1 hover:underline font-medium"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {isLoading && documents.length === 0 ? (
              <div className="text-center py-10">
                <RefreshCw size={24} className="text-slate animate-spin mx-auto" />
              </div>
            ) : documents.filter(d => activeFolderId ? d.folderId === activeFolderId : true).length === 0 ? (
              <div className="text-center py-12 bg-canvas border border-border-light rounded-lg text-muted text-[14px]">
                No documents found in this view.
              </div>
            ) : (
              <div className="space-y-3 pb-8">
                {documents.filter(d => activeFolderId ? d.folderId === activeFolderId : true).map((doc) => (
                  <div key={doc._id} className="flex flex-col p-4 bg-canvas border border-border-light rounded-lg hover:border-cohere-black hover:shadow-sm transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="p-2.5 bg-soft-stone rounded-md border border-border-light flex items-center justify-center text-ink shrink-0">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 pr-4">
                          <p className="text-[16px] font-medium text-ink truncate" title={doc.originalFileName || doc.fileName}>
                            {doc.originalFileName || doc.fileName}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[14px] text-muted whitespace-nowrap">{formatBytes(doc.fileSize)}</span>
                            <span className="text-border-light text-[10px]">•</span>
                            <span className="text-[12px] text-muted font-mono uppercase tracking-wide">{doc.fileType}</span>
                            {doc.chunkCount > 0 && (
                              <>
                                <span className="text-border-light text-[10px]">•</span>
                                <span className="text-[12px] text-muted">{doc.chunkCount} chunks</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Folder Selection Dropdown */}
                        <div className="relative group/folder">
                          <select
                            className="appearance-none bg-soft-stone/30 hover:bg-soft-stone text-xs text-ink font-medium px-2 py-1 pr-6 rounded border border-border-light outline-none cursor-pointer w-32 truncate"
                            value={doc.folderId || ''}
                            onChange={(e) => updateDocumentFolder(doc._id, e.target.value || null)}
                          >
                            <option value="">No Folder</option>
                            {folders.map(f => (
                              <option key={f._id} value={f._id}>{f.name}</option>
                            ))}
                          </select>
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                            <FolderIcon size={12} />
                          </div>
                        </div>

                        {/* Status Badges */}
                        {(doc.status === 'QUEUED' || doc.status === 'UPLOADING') && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-mono font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 uppercase">
                            <RefreshCw size={12} className="animate-spin" />
                            Queued
                          </span>
                        )}
                        {doc.status === 'PROCESSING' && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                            <RefreshCw size={12} className="animate-spin" />
                            Processing
                          </span>
                        )}
                        {doc.status === 'READY' && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-mono font-medium bg-pale-green text-deep-green border border-[#c1e8b5] uppercase">
                            <CheckCircle size={12} />
                            Ready
                          </span>
                        )}
                        {doc.status === 'FAILED' && (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-mono font-medium bg-error/5 text-error border border-error/20 uppercase">
                            <AlertCircle size={12} />
                            Failed
                          </span>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                          {doc.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(doc._id)}
                              className="p-2 hover:bg-slate/10 text-muted hover:text-ink rounded-md transition-colors"
                              title="Retry Ingestion"
                            >
                              <RotateCcw size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(doc._id)}
                            className="p-2 hover:bg-error/10 text-muted hover:text-error rounded-md transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Error message display for failed documents */}
                    {doc.status === 'FAILED' && doc.processingError && (
                      <div className="mt-3 ml-14 text-[13px] text-error bg-error/5 p-2 rounded border border-error/10 font-mono">
                        Error: {doc.processingError}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-light bg-soft-stone text-center text-[12px] text-muted shrink-0">
          DocuMind-AI processes documents securely using background queues and Pinecone vector stores.
        </div>
      </div>
    </div>
  );
}
