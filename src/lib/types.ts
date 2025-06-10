export type Region = 'West' | 'Ontario' | 'Atlantic' | 'Quebec';
export type Language = 'en' | 'fr';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  startTime: Date;
  region: Region | 'none';
  language: Language;
  messages: ChatMessage[];
  title: string; // First user message or a generated title
}
