"use client";

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Language } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { SendHorizonal } from 'lucide-react';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentLanguage: Language;
  isLoading: boolean;
}

const placeholders: Record<Language, string> = {
  en: "Type your message...",
  fr: "Écrivez votre message...",
};

export function ChatArea({ messages, onSendMessage, currentLanguage, isLoading }: ChatAreaProps) {
  const [inputText, setInputText] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText("");
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-chat-panel-background shadow-inner">
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-lg">No messages yet.</p>
            <p>Start a conversation!</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && messages.length > 0 && messages[messages.length - 1].sender === 'user' && (
          <div className="flex justify-start mb-4">
             <div className="max-w-[70%] rounded-xl px-4 py-3 shadow-md text-sm bg-secondary text-secondary-foreground rounded-bl-none">
                <p className="italic text-muted-foreground">Bot is typing...</p>
             </div>
          </div>
        )}
      </ScrollArea>
      <div className="p-4 border-t bg-background">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholders[currentLanguage]}
            className="flex-grow text-sm"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !inputText.trim()} className="text-sm">
            <SendHorizonal className="h-4 w-4 mr-2" />
            {currentLanguage === 'en' ? 'Send' : 'Envoyer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
