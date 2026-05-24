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
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocumentManager } from './components/DocumentManager';

interface Citation {
  fileName: string;
  pageNumber: number;
  text: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

function App() {
  const [showManager, setShowManager] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState<{ msgId: string; citationIndex: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    try {
      const response = await fetch('http://localhost:5005/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: query }),
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
        buffer = lines.pop() || ''; // Keep the incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (data.type === 'citations') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, citations: data.citations }
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
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (err) {
              console.error('Failed to parse SSE packet:', err);
            }
          }
        }
      }

      // Mark streaming completed
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
                content: `An error occurred: ${error.message || 'Make sure the backend server is running and database keys are configured.'}`, 
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
    <div className="flex h-screen bg-canvas text-ink overflow-hidden font-sans">
      {/* Sidebar - Cohere Dark Feature Band */}
      <aside className="w-64 bg-primary text-on-dark flex flex-col z-20 shadow-xl">
        <div className="p-8">
          <h1 className="text-2xl font-bold font-cohere-display tracking-tight text-on-dark">
            DocuMind AI
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 mt-4">
          <NavItem icon={<MessageSquare size={18} />} label="Chat" active />
          <NavItem icon={<Files size={18} />} label="Documents" onClick={() => setShowManager(true)} />
          <NavItem icon={<Search size={18} />} label="Search" />
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2 mb-4">
          <NavItem icon={<Settings size={18} />} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-canvas">
        {/* Header */}
        <header className="h-20 border-b border-border-light flex items-center justify-between px-10 bg-canvas z-10 shrink-0">
          <div className="flex items-center gap-3">
            <BookOpen size={18} className="text-cohere-black" />
            <span className="text-[14px] font-medium text-ink tracking-tight">Phase 1: Core RAG Foundation</span>
          </div>
          <button 
            onClick={() => setShowManager(true)}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-pill text-[14px] font-medium hover:bg-black transition-all shadow-md active:scale-95 tracking-tight"
          >
            <Upload size={16} />
            Upload Document
          </button>
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
                      <div className="bg-soft-stone border border-border-light text-ink rounded-2xl px-6 py-4 text-[16px] max-w-[80%] shadow-sm font-sans leading-relaxed">
                        {msg.content}
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
          <div className="max-w-4xl mx-auto bg-canvas p-2 rounded-xl flex items-center gap-3 border border-border-light shadow-sm focus-within:border-action-blue focus-within:shadow-md transition-all">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
              placeholder="Ask anything about your documents..." 
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-3 text-[16px] outline-none placeholder:text-muted font-sans text-ink"
            />
            <button 
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className={`p-3 rounded-lg transition-all ${
                input.trim() && !isLoading
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
}

function NavItem({ icon, label, active = false, onClick }: NavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-[14px] font-medium transition-all ${
        active 
          ? 'bg-coral text-on-dark shadow-md' 
          : 'text-white/60 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default App;
