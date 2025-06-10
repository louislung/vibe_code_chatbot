
export type Region = 'West' | 'Ontario' | 'Atlantic' | 'Quebec';
export type Language = 'en' | 'fr';

export interface ChatMessage {
  id: string; // Can be client-generated UUID or server's question_id
  sender: 'user' | 'bot';
  text: string; // For user: plain text. For bot: HTML string from server.
  timestamp: Date | string; // Allow string for initial data, ensure conversion to Date for use
}

export interface ChatSession {
  id: string; // Initially client UUID, then server's conversation_id
  startTime: Date | string; // Allow string for initial data, ensure conversion to Date for use
  region: Region | 'none';
  language: Language;
  messages: ChatMessage[];
  title: string; // First user message or a generated title
}

    