import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SearchResults } from '@/components/SearchResults';
import { MessageComponent } from '@/components/MessageComponent';
import { ModeIndicator } from '@/components/ModeIndicator';
import { AuthModal } from '@/components/AuthModal';
import { SidebarMenu } from '@/components/SidebarMenu';
import { ClearConfirmModal } from '@/components/ClearConfirmModal';

import { 
  Plus, 
  Trash, 
  Send, 
  Search, 
  RotateCw, 
  Menu, 
  Sun, 
  Moon,
  ChevronDown,
  Bot,
  Lightbulb,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import type { Chat } from '@/types/chat';

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const MAIN_TABS = [
  { id: 'assistant', label: 'AI Assistant', icon: Lightbulb, apiEndpoint: 'assistant', gradient: 'from-blue-500 to-purple-600' },
  { id: 'search', label: 'AI Search', icon: Search, apiEndpoint: 'search', gradient: 'from-green-500 to-blue-600' },
  { id: 'agent', label: 'AI Agent', icon: Cpu, apiEndpoint: 'agent', gradient: 'from-purple-500 to-pink-600' },
];

const Index = () => {
  // State variables
  const [allChats, setAllChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [currentQueryForChat, setCurrentQueryForChat] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [activeMainTab, setActiveMainTab] = useState(MAIN_TABS[0].id);
  const [theme, setTheme] = useState('dark');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [chatToClear, setChatToClear] = useState<string | null>(null);
  const [showScrollTip, setShowScrollTip] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmailOrPhone, setAuthEmailOrPhone] = useState('');

  // Debounced search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(chatSearchTerm);

  // Debounce effect for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(chatSearchTerm);
    }, 300);

    return () => clearTimeout(handler);
  }, [chatSearchTerm]);

  // Fetch local chats and health check
  useEffect(() => {
    const saved = localStorage.getItem('GenAiWorkspaceChats');
    if (saved) {
      try {
        const chats = JSON.parse(saved).map((c: any) => ({
          ...c,
          createdAt: c.createdAt || new Date(0).toISOString(),
          mode: c.mode || MAIN_TABS[0].id,
        }));
        setAllChats(chats);
        const lastTab = localStorage.getItem('GenAiWorkspaceLastMainTab') || MAIN_TABS[0].id;
        setActiveMainTab(lastTab);
        const lastChatId = localStorage.getItem('GenAiWorkspaceLastActiveChatId');
        const relevantChats = chats
          .filter((c: Chat) => c.mode === lastTab)
          .sort((a: Chat, b: Chat) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (lastChatId && relevantChats.find((c: Chat) => c.id === lastChatId))
          setActiveChatId(lastChatId);
        else if (relevantChats.length > 0)
          setActiveChatId(relevantChats[0].id);
      } catch {
        localStorage.removeItem('GenAiWorkspaceChats');
      }
    }
    fetch(`${API_BASE_URL}/health`)
      .then(res => {
        if (!res.ok) console.warn('API health check failed or API not running');
      })
      .catch(() => console.warn('Cannot connect to API'));
  }, []);

  // Persist chats & last state
  useEffect(() => {
    if (allChats.length > 0) localStorage.setItem('GenAiWorkspaceChats', JSON.stringify(allChats));
    else localStorage.removeItem('GenAiWorkspaceChats');
  }, [allChats]);

  useEffect(() => {
    if (activeChatId) localStorage.setItem('GenAiWorkspaceLastActiveChatId', activeChatId);
    else localStorage.removeItem('GenAiWorkspaceLastActiveChatId');
    localStorage.setItem('GenAiWorkspaceLastMainTab', activeMainTab);
  }, [activeChatId, activeMainTab]);

  // Change chat when tab switches
  useEffect(() => {
    const chats = allChats
      .filter(c => c.mode === activeMainTab)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (chats.length > 0) {
      if (!activeChatId || !chats.find(c => c.id === activeChatId)) {
        setActiveChatId(chats[0].id);
      }
    } else {
      setActiveChatId(null);
    }
    setCurrentQueryForChat('');
    setApiError('');
  }, [activeMainTab, allChats, activeChatId]);

  const activeChat = allChats.find(c => c.id === activeChatId) || null;

  // Memoized filtered chats based on debounced search term
  const filteredChats = useMemo(() => {
    return allChats
      .filter(c =>
        c.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (debouncedSearchTerm.length > 2 && c.messages.some(m => m.text.toLowerCase().includes(debouncedSearchTerm.toLowerCase())))
      )
      .filter(c => c.mode === activeMainTab);
  }, [allChats, debouncedSearchTerm, activeMainTab]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeChat) {
      scrollToBottom();
    }
  }, [activeChat?.messages, isLoading]);

  // Reset query on chat change
  useEffect(() => {
    if (!activeChat || activeChat.messages.length === 0) setCurrentQueryForChat('');
  }, [activeChat]);

  const currentTabConfig = MAIN_TABS.find(t => t.id === activeMainTab) || MAIN_TABS[0];

  const handleNewChat = () => {
    const id = generateUniqueId();
    const title = `${currentTabConfig.label} Chat`;
    const newChat: Chat = {
      id,
      title,
      messages: [],
      mode: activeMainTab,
      createdAt: new Date().toISOString(),
    };
    setAllChats(prev => [newChat, ...prev]);
    setActiveChatId(id);
    setCurrentQueryForChat('');
    if (textareaRef.current) textareaRef.current.focus();
    setPopupOpen(false);
    toast({
      title: "New chat created",
      description: `Started a new ${currentTabConfig.label} chat`,
    });
  };

  const handleSelectChat = (id: string) => {
    const chat = allChats.find(c => c.id === id);
    if (chat && chat.mode === activeMainTab) {
      setActiveChatId(id);
      setApiError('');
      if (textareaRef.current) textareaRef.current.focus();
    }
  };

  const handleDeleteChat = (id: string) => {
    setAllChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
      const remaining = allChats
        .filter(c => c.id !== id && c.mode === activeMainTab)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
      setApiError('');
    }
    toast({
      title: "Chat deleted",
      description: "The chat has been permanently deleted",
    });
  };

  const handleClearMessagesInActiveChat = () => {
    if (!activeChat || activeChat.messages.length === 0) return;
    setChatToClear(activeChat.id);
    setShowClearConfirm(true);
  };

  const confirmClearChat = () => {
    if (chatToClear) {
      setAllChats(prev => prev.map(c => c.id === chatToClear ? { ...c, messages: [] } : c));
      if (activeChat && activeChat.id === chatToClear) {
        setActiveChatId(null);
      }
      toast({
        title: "Chat cleared",
        description: "All messages have been removed from the chat",
      });
    }
    setShowClearConfirm(false);
    setChatToClear(null);
  };

  const cancelClearChat = () => {
    setShowClearConfirm(false);
    setChatToClear(null);
  };

  const handleSendMessageToChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChat || !currentQueryForChat.trim()) {
      if (!currentQueryForChat.trim() && activeChat) setApiError('Please enter a message.');
      return;
    }

    const userMsg = { sender: 'user' as const, text: currentQueryForChat, timestamp: new Date().toISOString() };
    const isDefaultTitle = activeChat.title.startsWith(`New ${currentTabConfig.label}`);
    const newTitle = isDefaultTitle && activeChat.messages.length === 0 && currentQueryForChat.length > 0
      ? currentQueryForChat.substring(0, 35) + (currentQueryForChat.length > 35 ? '...' : '')
      : activeChat.title;

    setAllChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, title: newTitle, messages: [...c.messages, userMsg] } : c));
    const query = currentQueryForChat;
    setCurrentQueryForChat('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setIsLoading(true);
    setApiError('');
    try {
      const res = await fetch(`${API_BASE_URL}/${activeChat.mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ response: `HTTP ${res.status}` }));
        throw new Error(errData.response || 'Request failed');
      }
      const data = await res.json();

      const botMsg = {
        sender: 'bot' as const,
        text: data.response || 'No response.',
        mode: activeChat.mode,
        timestamp: new Date().toISOString(),
        searchResults: activeChat.mode === 'search' && data.searchResults ? data.searchResults : null,
      };

      setAllChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, messages: [...c.messages, botMsg] } : c));
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Error during request';
      setApiError(errMsg);
      const errorMsg = {
        sender: 'bot' as const,
        text: `Error: ${errMsg}`,
        mode: activeChat.mode,
        isError: true,
        timestamp: new Date().toISOString(),
      };
      setAllChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, messages: [...c.messages, errorMsg] } : c));
    } finally {
      setIsLoading(false);
      if (textareaRef.current) textareaRef.current.focus();
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage('⚙️ Starting manual sync...');
    setApiError('');
    try {
      const res = await fetch(`${API_BASE_URL}/sync`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(errData.message || 'Sync failed');
      }
      const data = await res.json();
      setSyncMessage(`✅ ${data.message || 'Sync request sent.'}`);
      toast({
        title: "Sync completed",
        description: data.message || 'Sync request sent successfully',
      });
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Sync failed';
      setSyncMessage(`❌ Sync failed: ${errMsg}`);
      toast({
        title: "Sync failed",
        description: errMsg,
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 7000);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Outside click handler for popup menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupOpen && !(e.target as Element)?.closest('.popup-menu')) {
        setPopupOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [popupOpen]);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Text has been copied to your clipboard",
    });
  };

  const handleScroll = () => {
    if (messagesEndRef.current && messagesEndRef.current.parentNode) {
      const { scrollTop, scrollHeight, clientHeight } = messagesEndRef.current.parentNode as Element;
      if (scrollHeight - scrollTop - clientHeight > 100) {
        setShowScrollTip(true);
      } else {
        setShowScrollTip(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      
      {/* Header */}
      <header className="relative z-50 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    GenAI Products
                  </h1>
                  <p className="text-xs text-slate-400">powered by GenAI Lakes</p>
                </div>
              </div>
              
              {/* Mode Tabs */}
              <div className="hidden md:flex ml-8 bg-slate-800/50 rounded-xl p-1">
                {MAIN_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveMainTab(tab.id)}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeMainTab === tab.id
                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-3">
              <Button
                onClick={handleNewChat}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
              
              <Button
                onClick={() => setShowAuthModal(true)}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Login
              </Button>

              <Button
                onClick={toggleTheme}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>

              <div className="relative">
                <Button
                  onClick={() => setPopupOpen(!popupOpen)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white popup-menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
                
                {popupOpen && (
                  <SidebarMenu
                    chatSearchTerm={chatSearchTerm}
                    setChatSearchTerm={setChatSearchTerm}
                    filteredChats={filteredChats}
                    activeMainTab={activeMainTab}
                    setActiveMainTab={setActiveMainTab}
                    setPopupOpen={setPopupOpen}
                    handleSelectChat={handleSelectChat}
                    handleDeleteChat={handleDeleteChat}
                    MAIN_TABS={MAIN_TABS}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden max-w-6xl mx-auto w-full px-6 py-4">
        {/* Chat Messages Container */}
        <div
          className="flex-1 overflow-y-auto p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50 backdrop-blur-sm relative"
          onScroll={handleScroll}
          style={{ scrollbarWidth: 'thin' }}
        >
          {activeChat && activeChat.messages.length > 0 ? (
            <div className="space-y-6">
              {activeChat.messages.map((msg, index) => (
                <MessageComponent 
                  key={index} 
                  msg={msg} 
                  onCopy={handleCopyText}
                  currentTabConfig={currentTabConfig}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-full text-center">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${currentTabConfig.gradient} flex items-center justify-center mb-6`}>
                <currentTabConfig.icon className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome to {currentTabConfig.label}
              </h2>
              <p className="text-slate-400 text-lg mb-8 max-w-md">
                {activeMainTab === 'search' ? 'Search the web with AI-powered insights and get comprehensive results.' :
                 activeMainTab === 'agent' ? 'Let me help you with complex tasks and workflows.' :
                 'Start a conversation with your AI assistant for any questions or tasks.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                {['Ask a question', 'Get help with tasks', 'Explore ideas'].map((action, idx) => (
                  <div key={idx} className="p-4 bg-slate-700/50 rounded-xl border border-slate-600/50 hover:bg-slate-700/70 transition-colors">
                    <p className="text-sm text-slate-300">{action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="flex justify-start mb-6">
              <div className={`bg-gradient-to-br ${currentTabConfig.gradient} px-6 py-4 rounded-2xl rounded-bl-md max-w-xs`}>
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-sm text-white/90">
                    {activeMainTab === 'search' ? 'Searching...' : 'Thinking...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollTip && (
          <Button
            onClick={scrollToBottom}
            className="fixed bottom-24 right-8 w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-600 shadow-lg z-40"
            size="sm"
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
        )}

        {/* Input Area */}
        <div className="mt-4 space-y-4">
          {/* Error Display */}
          {apiError && (
            <div className="p-4 bg-red-900/50 border border-red-700/50 rounded-xl text-red-200 text-sm backdrop-blur-sm">
              <div className="flex items-center">
                <span className="text-red-400 mr-2">⚠️</span>
                {apiError}
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessageToChat} className="relative">
            <div className="relative bg-slate-800/50 rounded-2xl border border-slate-600/50 backdrop-blur-sm focus-within:border-blue-500/50 transition-colors">
              <Textarea
                ref={textareaRef}
                className="w-full min-h-[60px] max-h-48 p-4 pr-16 bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-white placeholder-slate-400 text-base"
                placeholder={
                  activeMainTab === 'search' ? 'Search for anything...' :
                  activeMainTab === 'agent' ? 'What task can I help you with?' :
                  'Type your message...'
                }
                value={currentQueryForChat}
                onChange={(e) => {
                  setCurrentQueryForChat(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessageToChat();
                  }
                }}
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !currentQueryForChat.trim()}
                className={`absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-gradient-to-r ${currentTabConfig.gradient} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>

          {/* Bottom Actions */}
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-500">
              Press Enter to send, Shift+Enter for new line
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleManualSync}
                variant="ghost"
                size="sm"
                disabled={isSyncing}
                className="text-slate-400 hover:text-white"
              >
                <RotateCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button
                onClick={handleClearMessagesInActiveChat}
                variant="ghost"
                size="sm"
                disabled={!activeChat || activeChat.messages.length === 0}
                className="text-red-400 hover:text-red-300"
              >
                <Trash className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <ClearConfirmModal
        showClearConfirm={showClearConfirm}
        confirmClearChat={confirmClearChat}
        cancelClearChat={cancelClearChat}
      />

      <AuthModal
        showAuthModal={showAuthModal}
        setShowAuthModal={setShowAuthModal}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authEmailOrPhone={authEmailOrPhone}
        setAuthEmailOrPhone={setAuthEmailOrPhone}
      />

      {/* Sync message */}
      {syncMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 backdrop-blur-sm">
          {syncMessage}
        </div>
      )}
    </div>
  );
};

export default Index;
