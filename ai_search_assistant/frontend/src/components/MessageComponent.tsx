"use client";

import React from 'react';
import { SearchResults } from './SearchResults';
import { Copy, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageComponentProps {
  msg: {
    sender: string;
    text: string;
    mode?: string;
    timestamp: string;
    isError?: boolean;
    searchResults?: any[];
  };
  onCopy: (text: string) => void;
  currentTabConfig: {
    gradient: string;
    label: string;
  };
}

export const MessageComponent: React.FC<MessageComponentProps> = ({ msg, onCopy, currentTabConfig }) => {
  const isUser = msg.sender === 'user';
  const isSearch = msg.mode === 'search';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className="max-w-3xl flex items-start space-x-4">
        {!isUser && (
          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${currentTabConfig.gradient} flex items-center justify-center flex-shrink-0 mt-1`}>
            <Bot className="w-4 h-4 text-white" />
          </div>
        )}
        
        <div className="flex-1">
          {/* Message Bubble */}
          <div
            className={`px-6 py-4 rounded-2xl shadow-lg break-words relative ${
              isUser 
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md' 
                : msg.isError
                ? 'bg-red-900/50 border border-red-700/50 text-red-200'
                : 'bg-slate-700/50 border border-slate-600/50 text-slate-100 rounded-bl-md backdrop-blur-sm'
            }`}
          >
            {/* Mode indicator for bot messages */}
            {!isUser && msg.mode && (
              <div className="flex items-center mb-3 text-xs opacity-75">
                <span className="px-2 py-1 bg-slate-600/50 rounded-lg text-slate-300 capitalize">
                  {msg.mode}
                </span>
              </div>
            )}

            <div className="prose prose-invert max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap mb-0">{msg.text}</p>
            </div>

            {/* Copy button for bot messages */}
            {!isUser && (
              <Button
                onClick={() => onCopy(msg.text)}
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 p-0 hover:bg-slate-600/50"
                title="Copy message"
              >
                <Copy className="w-3 h-3" />
              </Button>
            )}

            {/* Timestamp */}
            <div className={`mt-3 text-xs ${isUser ? 'text-blue-100' : 'text-slate-400'} text-right`}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>

          {/* Search Results */}
          {isSearch && !isUser && msg.searchResults && (
            <div className="mt-4">
              <SearchResults results={msg.searchResults} onCopy={onCopy} />
            </div>
          )}
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  );
};
