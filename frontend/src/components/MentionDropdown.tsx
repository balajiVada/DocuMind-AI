import { useEffect, useRef, useState } from 'react';
import { Folder as FolderIcon, FileText } from 'lucide-react';
import type { Folder } from '../services/folderService';
import type { Document } from '../types/document';

export interface MentionItem {
  id: string;
  type: 'folder' | 'document';
  name: string;
}

interface MentionDropdownProps {
  query: string;
  folders: Folder[];
  documents: Document[];
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

export function MentionDropdown({ query, folders, documents, onSelect, onClose }: MentionDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  const lowercaseQuery = query.toLowerCase();
  
  const filteredFolders: MentionItem[] = folders
    .filter(f => f.name.toLowerCase().includes(lowercaseQuery))
    .map(f => ({ id: f._id, type: 'folder', name: f.name }));
    
  const filteredDocs: MentionItem[] = documents
    .filter(d => (d.originalFileName || d.fileName).toLowerCase().includes(lowercaseQuery))
    .map(d => ({ id: d._id, type: 'document', name: d.originalFileName || d.fileName }));

  const items = [...filteredFolders, ...filteredDocs].slice(0, 8); // Max 8 items

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (items.length === 0) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onSelect(items[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [items, selectedIndex, onSelect, onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (items.length === 0) {
    return (
      <div 
        ref={dropdownRef}
        className="absolute bottom-full left-0 mb-2 w-64 bg-canvas border border-border-light rounded-lg shadow-xl overflow-hidden z-50 text-[13px]"
      >
        <div className="p-3 text-muted text-center italic">No matches found</div>
      </div>
    );
  }

  return (
    <div 
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-2 w-72 bg-canvas border border-border-light rounded-lg shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200 text-[13px]"
    >
      <div className="bg-soft-stone px-3 py-1.5 text-[11px] font-bold text-slate uppercase tracking-wider border-b border-border-light">
        Select Context
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {items.map((item, index) => (
          <button
            key={`${item.type}-${item.id}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
              index === selectedIndex ? 'bg-action-blue/10 text-action-blue' : 'text-ink hover:bg-black/5'
            }`}
          >
            {item.type === 'folder' ? (
              <FolderIcon size={14} className="shrink-0" />
            ) : (
              <FileText size={14} className="shrink-0" />
            )}
            <span className="truncate flex-1 font-medium">{item.name}</span>
            <span className="text-[10px] uppercase text-muted font-mono">{item.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
