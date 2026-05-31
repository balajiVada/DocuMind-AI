import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  MessageSquare, 
  Files, 
  Settings, 
  Search, 
  Send, 
  RefreshCw, 
  BookOpen, 
  ArrowRight,
  Trash2,
  PanelLeft,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocumentManager } from '../components/DocumentManager';

import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore } from '../stores/useChatStore';
import { usePipelineInspectorStore } from '../stores/usePipelineInspectorStore';
import { useFoldersStore } from '../stores/useFoldersStore';
import { useDocumentsStore } from '../stores/useDocumentsStore';
import { apiClient } from '../services/api';
import { PipelineInspector } from '../components/PipelineInspector';
import { MentionDropdown } from '../components/MentionDropdown';
import type { MentionItem } from '../components/MentionDropdown';

interface Citation {
  chunkId?: string;
  documentId?: string;
  fileName: string;
  pageNumber: number;
  text: string;
  score: number;
  retrievalMethod?: 'semantic' | 'keyword' | 'hybrid';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  metrics?: any;
  isStreaming?: boolean;
}

function ChatPage() {
  const { token, workspaces, activeWorkspaceId, setActiveWorkspace, logout } = useAuthStore();
  const { 
    sessions, activeSessionId, isLoadingSessions, 
    fetchSessions, setActiveSession, deleteSession 
  } = useChatStore();
  const { addStep, resetRun } = usePipelineInspectorStore();

  const [showManager, setShowManager] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<{ msgId: string; citationIndex: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const skipNextFetchRef = useRef<boolean>(false);

  const { folders, fetchFolders } = useFoldersStore();
  const { documents, fetchDocuments } = useDocumentsStore();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth >= 1024);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Mention State
  const [selectedContexts, setSelectedContexts] = useState<MentionItem[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      } else if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch sessions on mount or workspace change
  useEffect(() => {
    if (activeWorkspaceId) {
      fetchSessions();
      fetchFolders();
      fetchDocuments();
    }
  }, [activeWorkspaceId]);

  // Fetch messages when activeSessionId changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeSessionId) {
        setMessages([]);
        return;
      }
      if (skipNextFetchRef.current) {
        skipNextFetchRef.current = false;
        return;
      }
      try {
        const response = await apiClient.get(`/chat/sessions/${activeSessionId}/messages`);
        const mappedMessages = response.data.map((msg: any) => ({
          id: msg._id,
          role: msg.role,
          content: msg.content,
          citations: msg.citations,
          metrics: msg.retrievalMetadata
        }));
        setMessages(mappedMessages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    fetchMessages();
  }, [activeSessionId]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // Check if we are currently mentioning
    const lastAtIndex = val.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Ensure it's either at the beginning or preceded by a space
      if (lastAtIndex === 0 || val[lastAtIndex - 1] === ' ') {
        const query = val.slice(lastAtIndex + 1);
        // Only show if there are no spaces after @
        if (!query.includes(' ')) {
          setShowMentionMenu(true);
          setMentionQuery(query);
          return;
        }
      }
    }
    setShowMentionMenu(false);
  };

  const handleMentionSelect = (item: MentionItem) => {
    // Replace the @query with @ItemName in the input
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const mentionName = item.name.replace(/\s+/g, '_');
      const newInput = input.slice(0, lastAtIndex) + '@' + mentionName + ' ';
      setInput(newInput);
      
      // Store the mapped name so we can verify it later
      if (!selectedContexts.find(c => c.id === item.id && c.type === item.type)) {
        setSelectedContexts(prev => [...prev, { ...item, name: mentionName }]);
      }
    }
    
    setShowMentionMenu(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };



  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    if (!textToSend) setInput('');
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const initialAssistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      citations: [],
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    resetRun(Date.now().toString()); // Placeholder ID, will be replaced by backend runId

    // Clear mention state just in case
    setShowMentionMenu(false);
    setMentionQuery('');
    
    // Filter selected contexts to only those actually still present in the query string
    const activeContexts = selectedContexts.filter(c => query.includes(`@${c.name}`));
    setSelectedContexts([]); // Clear for next query

    try {
      const folderIds = activeContexts.filter(c => c.type === 'folder').map(c => c.id);
      const documentIds = activeContexts.filter(c => c.type === 'document').map(c => c.id);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeWorkspaceId ? { 'x-workspace-id': activeWorkspaceId } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          message: query,
          sessionId: activeSessionId,
          filters: { folderIds, documentIds }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response from server.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream available.');

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.type === 'citations') {
                if (data.sessionId && data.sessionId !== activeSessionId) {
                  // If backend created a new session, update store but skip the fetch effect
                  skipNextFetchRef.current = true;
                  setActiveSession(data.sessionId);
                  fetchSessions(); // refresh sidebar
                }

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, citations: data.citations, metrics: data.metrics }
                      : msg
                  )
                );
              } else if (data.type === 'token') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + data.token }
                      : msg
                  )
                );
              } else if (data.type === 'pipeline_step') {
                addStep(data.runId, data.payload);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (err) {
              console.error('Failed to parse SSE packet:', err);
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
        )
      );

    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { 
                ...msg, 
                content: `An error occurred: ${error.message || 'Make sure the backend server is running.'}`, 
                isStreaming: false 
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    handleSend(prompt);
  };

  const suggestionPrompts = [
    "What are the main findings in our onboarding report?",
    "Summarize the key deliverables mentioned in our agreements.",
    "Explain the termination policy guidelines.",
    "Show me the renewal terms defined in the contract."
  ];

  return (
    <div className="flex h-screen bg-canvas text-ink overflow-hidden font-sans relative">
      
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30 transition-opacity" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Cohere Dark Feature Band */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 bg-primary text-on-dark flex flex-col shadow-xl transition-all duration-300 ease-in-out
          ${isSidebarExpanded ? 'w-[260px]' : 'w-[72px]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0
        `}
      >
        <div className={`p-4 flex items-center ${isSidebarExpanded ? 'justify-between' : 'justify-center'} mt-2`}>
          {isSidebarExpanded && (
            <h1 className="text-xl font-bold font-cohere-display tracking-tight text-on-dark truncate px-2">
              DocuMind AI
            </h1>
          )}
          <button 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white hidden md:block"
            title={isSidebarExpanded ? "Close sidebar" : "Open sidebar"}
          >
            <PanelLeft size={20} />
          </button>
          <button 
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-md hover:bg-white/10 text-white/70 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Workspace Selector */}
        <div className="px-3 mb-4">
          <select 
            className={`bg-white/10 text-on-dark text-sm p-2 rounded-md outline-none border border-white/20 focus:border-white/50 cursor-pointer transition-all ${isSidebarExpanded ? 'w-full' : 'w-12 mx-auto appearance-none text-center'}`}
            value={activeWorkspaceId || ''}
            onChange={(e) => setActiveWorkspace(e.target.value)}
            title="Workspace"
          >
            {workspaces.map(ws => (
              <option key={ws._id} value={ws._id} className="bg-primary text-on-dark">
                {isSidebarExpanded ? ws.name : ws.name.charAt(0).toUpperCase()}
              </option>
            ))}
            {workspaces.length === 0 && (
              <option value="" disabled className="bg-primary text-on-dark">
                {isSidebarExpanded ? 'No workspaces' : '-'}
              </option>
            )}
          </select>
        </div>
        
        <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto overflow-x-hidden">
          <NavItem icon={<MessageSquare size={18} />} label="New Chat" active={!activeSessionId} onClick={() => { setActiveSession(null); setMessages([]); if(window.innerWidth < 768) setIsMobileOpen(false); }} isExpanded={isSidebarExpanded} />
          <NavItem icon={<Files size={18} />} label="Documents" onClick={() => { setShowManager(true); if(window.innerWidth < 768) setIsMobileOpen(false); }} isExpanded={isSidebarExpanded} />
          <NavItem icon={<Search size={18} />} label="Search" isExpanded={isSidebarExpanded} />

          {isSidebarExpanded && (
            <>
              <div className="pt-6 pb-2 px-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Recent Chats</span>
              </div>
              {isLoadingSessions ? (
                <div className="px-3 text-sm text-muted animate-pulse">Loading...</div>
              ) : (
                sessions.map(session => (
                  <div key={session._id} className="group relative flex items-center pr-1">
                    <button
                      onClick={() => { setActiveSession(session._id); if(window.innerWidth < 768) setIsMobileOpen(false); }}
                      className={`flex-1 text-left px-3 py-2 rounded-md text-[13px] truncate transition-all ${
                        activeSessionId === session._id 
                          ? 'bg-white/10 text-white font-medium' 
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {session.title}
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this chat?')) {
                          await deleteSession(session._id);
                          if (activeSessionId === session._id) {
                            setMessages([]);
                          }
                        }
                      }}
                      className="absolute right-1 opacity-0 group-hover:opacity-100 p-1.5 text-white/40 hover:text-coral hover:bg-white/10 rounded transition-all bg-primary"
                      title="Delete Chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1 mb-2">
          <NavItem icon={<Settings size={18} />} label="Settings" isExpanded={isSidebarExpanded} />
          <button 
            onClick={logout}
            className={`w-full flex items-center ${isSidebarExpanded ? 'justify-start gap-3 px-3' : 'justify-center px-0'} py-2.5 rounded-md text-[14px] font-medium transition-all text-white/60 hover:text-white hover:bg-white/5`}
            title={!isSidebarExpanded ? 'Logout' : undefined}
          >
            <RefreshCw size={18} className="shrink-0" />
            {isSidebarExpanded && <span className="truncate">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col relative min-w-0 bg-canvas transition-all duration-300 ease-in-out ${isSidebarExpanded ? 'md:ml-[260px]' : 'md:ml-[72px]'}`}>
        {/* Header */}
        <header className="h-16 border-b border-border-light flex items-center justify-between px-4 sm:px-6 bg-canvas z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-md hover:bg-soft-stone text-muted hover:text-ink"
            >
              <PanelLeft size={20} />
            </button>
            <BookOpen size={18} className="text-cohere-black hidden sm:block" />
            <span className="text-[14px] font-medium text-ink tracking-tight truncate">Phase 1: Core RAG Foundation</span>
          </div>
          <div className="flex items-center gap-3">
            {import.meta.env.DEV && (
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className={`p-2 rounded-full transition-colors ${showDebug ? 'bg-coral text-on-dark shadow-inner' : 'bg-soft-stone text-muted hover:text-ink'}`}
                title="Toggle Retrieval Debug Panel"
              >
                <Settings size={18} />
              </button>
            )}
            <button 
              onClick={() => setShowManager(true)}
              className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-pill text-[14px] font-medium hover:bg-black transition-all shadow-md active:scale-95 tracking-tight"
            >
              <Upload size={16} />
              Upload Document
            </button>
          </div>
        </header>

        {/* Dynamic Chat / Welcome Area */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8">
          {messages.length === 0 ? (
            /* Welcome / Suggestion Board */
            <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto space-y-12 animate-in pb-20">
              <div className="w-20 h-20 bg-pale-green rounded-2xl flex items-center justify-center border border-border-light shadow-sm">
                <MessageSquare size={32} className="text-deep-green" />
              </div>
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-cohere-display text-cohere-black">
                  Enterprise Knowledge Intelligence
                </h2>
                <p className="text-body-muted text-[18px] max-w-xl mx-auto leading-relaxed font-sans">
                  Ask conversational questions, extract insights, and get instant page-cited answers from all your uploaded enterprise files.
                </p>
              </div>

              {/* Suggestion Board */}
              <div className="grid grid-cols-2 gap-4 w-full pt-8">
                {suggestionPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(prompt)}
                    className="p-6 text-left bg-canvas border border-border-light rounded-lg hover:border-cohere-black hover:shadow-md transition-all text-[16px] text-ink flex items-center justify-between group"
                  >
                    <span className="truncate pr-4 font-sans">{prompt}</span>
                    <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-action-blue shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages Stream */
            <div className="max-w-4xl mx-auto space-y-10 pb-8">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-4 animate-in">
                  <div className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {/* User Message Bubble */}
                    {msg.role === 'user' ? (
                      <div className="bg-soft-stone border border-border-light text-ink rounded-2xl px-6 py-4 text-[16px] max-w-[80%] shadow-sm font-sans leading-relaxed whitespace-pre-wrap">
                        {msg.content.split(/(@\S+)/g).map((part, i) => 
                          part.startsWith('@') ? (
                            <span key={i} className="text-action-blue font-semibold">{part}</span>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                      </div>
                    ) : (
                      /* Assistant Message Bubble */
                      <div className="flex gap-5 items-start w-full">
                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary shrink-0 font-bold text-sm mt-1 shadow-md">
                          AI
                        </div>
                        <div className="flex-1 space-y-5">
                          <div className="text-[16px] leading-relaxed text-ink font-sans">
                            {msg.content === '' && msg.isStreaming ? (
                              <span className="flex items-center gap-2 text-muted text-sm font-medium">
                                <RefreshCw size={16} className="animate-spin" /> Thinking and retrieving sources...
                              </span>
                            ) : (
                              <div className="markdown-body">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>

                          {/* Citation Cards (Under the message) */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-border-light">
                              <span className="text-[12px] font-semibold text-muted uppercase tracking-wider block font-sans">Grounded Sources ({msg.citations.length})</span>
                              <div className="flex flex-wrap gap-2">
                                {msg.citations.map((citation, cIdx) => (
                                  <button
                                    key={cIdx}
                                    onClick={() => {
                                      const isActive = activeCitation?.msgId === msg.id && activeCitation?.citationIndex === cIdx;
                                      setActiveCitation(isActive ? null : { msgId: msg.id, citationIndex: cIdx });
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center gap-2 border transition-all ${
                                      activeCitation?.msgId === msg.id && activeCitation?.citationIndex === cIdx
                                        ? 'bg-action-blue text-white border-action-blue shadow-md'
                                        : 'bg-canvas border-border-light hover:border-cohere-black text-ink'
                                    }`}
                                  >
                                    <BookOpen size={12} />
                                    <span className="max-w-[140px] truncate">{citation.fileName}</span>
                                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] ${
                                      activeCitation?.msgId === msg.id && activeCitation?.citationIndex === cIdx
                                        ? 'bg-white/20'
                                        : 'bg-soft-stone text-muted'
                                    }`}>
                                      P.{citation.pageNumber}
                                    </span>
                                  </button>
                                ))}
                              </div>

                              {/* Citation Source Panel (Expandable details) */}
                              {msg.citations.map((citation, cIdx) => {
                                const isShowing = activeCitation?.msgId === msg.id && activeCitation?.citationIndex === cIdx;
                                if (!isShowing) return null;

                                return (
                                  <div 
                                    key={cIdx} 
                                    className="p-5 rounded-lg bg-soft-stone border border-border-light text-[14px] text-ink mt-3 space-y-3 animate-in relative overflow-hidden"
                                  >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-action-blue" />
                                    <div className="flex justify-between items-center text-muted font-mono text-[12px]">
                                      <span className="font-semibold text-action-blue flex items-center gap-1 uppercase tracking-wide">
                                        Source {cIdx + 1}: {citation.fileName} (Pg {citation.pageNumber})
                                      </span>
                                      <span>Match: {Math.round(citation.score * 100)}%</span>
                                    </div>
                                    <blockquote className="italic border-l-2 border-hairline pl-4 text-body-muted whitespace-pre-wrap leading-relaxed font-serif">
                                      "{citation.text}"
                                    </blockquote>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar Area */}
        <div className="p-10 pt-4 shrink-0 bg-canvas">
          <div className="max-w-4xl mx-auto bg-canvas p-2 rounded-xl flex items-center gap-3 border border-border-light shadow-sm focus-within:border-action-blue focus-within:shadow-md transition-all relative">
            
            {/* Mention Dropdown */}
            {showMentionMenu && (
              <MentionDropdown
                query={mentionQuery}
                folders={folders}
                documents={documents}
                onSelect={handleMentionSelect}
                onClose={() => {
                  setShowMentionMenu(false);
                  setMentionQuery('');
                }}
              />
            )}

            <div className="flex-1 flex items-center flex-wrap gap-1 px-2">
              <input 
                ref={inputRef}
                type="text" 
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !showMentionMenu) {
                    handleSend();
                  }
                }}
                disabled={isLoading}
                placeholder="Ask anything about your documents... (Type @ to select)"
                className="flex-1 min-w-[200px] bg-transparent border-none focus:ring-0 py-2 text-[16px] outline-none placeholder:text-muted font-sans text-ink"
              />
            </div>

            <button 
              onClick={() => handleSend()}
              disabled={isLoading || (!input.trim() && selectedContexts.length === 0)}
              className={`p-3 rounded-lg transition-all ${
                (input.trim() || selectedContexts.length > 0) && !isLoading
                  ? 'bg-primary hover:bg-black text-on-primary shadow-md'
                  : 'bg-soft-stone text-muted cursor-not-allowed'
              }`}
            >
              <Send size={20} />
            </button>
          </div>
          <div className="max-w-4xl mx-auto mt-3 text-center">
            <span className="text-[12px] text-muted font-sans">
              Responses are generated by AI and may be inaccurate. Verify important information.
            </span>
          </div>
        </div>
      </main>

      {/* AI Pipeline Inspector (DEV Mode Only) */}
      {showDebug && import.meta.env.DEV && (
        <aside className="w-[360px] border-l border-white/10 flex flex-col z-10 shrink-0">
          <PipelineInspector />
        </aside>
      )}

      {/* Upload/Knowledge Base Modal */}
      {showManager && <DocumentManager onClose={() => setShowManager(false)} />}
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  isExpanded?: boolean;
}

function NavItem({ icon, label, active = false, onClick, isExpanded = true }: NavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center ${isExpanded ? 'justify-start gap-3 px-3' : 'justify-center px-0'} py-2.5 rounded-md text-[14px] font-medium transition-all ${
        active 
          ? 'bg-white/10 text-white' 
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
      title={!isExpanded ? label : undefined}
    >
      <div className="shrink-0">
        {icon}
      </div>
      <span className={`truncate transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto ml-1' : 'opacity-0 w-0 overflow-hidden'}`}>
        {label}
      </span>
    </button>
  );
}

export default ChatPage;
