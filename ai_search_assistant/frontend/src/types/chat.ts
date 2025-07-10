
export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  mode: string;
  createdAt: string;
}

export interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  mode?: string;
  isError?: boolean;
  searchResults?: SearchResult[] | null;
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  domain?: string;
  date?: string;
}
