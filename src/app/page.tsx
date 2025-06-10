"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { HeaderBar } from "@/components/chat/HeaderBar";
import { ChatArea } from "@/components/chat/ChatArea";
import { HistoryPanel } from "@/components/chat/HistoryPanel";
import type { ChatSession, ChatMessage, Region, Language } from "@/lib/types";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

// Mock initial data
const initialChatSessions: ChatSession[] = [
  {
    id: uuidv4(),
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    region: 'Ontario',
    language: 'en',
    messages: [
      { id: uuidv4(), sender: 'user', text: 'Hello, I have a question about services in Ontario.', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { id: uuidv4(), sender: 'bot', text: 'Hello! I can help with that. What is your question regarding Ontario services?', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60000) },
    ],
    title: 'Ontario Services Query'
  },
  {
    id: uuidv4(),
    startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    region: 'Quebec',
    language: 'fr',
    messages: [
      { id: uuidv4(), sender: 'user', text: 'Bonjour, je cherche des informations pour le Québec.', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { id: uuidv4(), sender: 'bot', text: 'Bonjour! Comment puis-je vous aider concernant le Québec?', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 60000) },
    ],
    title: 'Infos Québec'
  },
];


export default function ChatPage() {
  const [showHistory, setShowHistory] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [region, setRegion] = useState<Region | 'none'>('none');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(initialChatSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialChatSessions.length > 0 ? initialChatSessions.sort((a,b) => b.startTime.getTime() - a.startTime.getTime())[0].id : null
  );
  const [isBotLoading, setIsBotLoading] = useState(false);
  const { toast } = useToast();

  const currentMessages = useMemo(() => {
    if (!currentSessionId) return [];
    const session = chatSessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  }, [currentSessionId, chatSessions]);

  const handleToggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  const handleSelectSession = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      // Optionally, update global lang/region selectors to match session, or keep them for new chats.
      // For now, global selectors control new chats.
      // setLanguage(session.language);
      // setRegion(session.region);
    }
  };
  
  useEffect(() => {
    // If currentSessionId is null and there are sessions, select the latest one.
    if (!currentSessionId && chatSessions.length > 0) {
      const latestSession = [...chatSessions].sort((a,b) => b.startTime.getTime() - a.startTime.getTime())[0];
      setCurrentSessionId(latestSession.id);
    }
  }, [chatSessions, currentSessionId]);


  const handleSendMessage = (text: string) => {
    setIsBotLoading(true);
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    let targetSessionId = currentSessionId;

    if (!targetSessionId) {
      const newSession: ChatSession = {
        id: uuidv4(),
        startTime: new Date(),
        language,
        region,
        messages: [userMessage],
        title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      };
      setChatSessions(prev => [newSession, ...prev].sort((a,b) => b.startTime.getTime() - a.startTime.getTime()));
      setCurrentSessionId(newSession.id);
      targetSessionId = newSession.id;
      toast({ title: "New chat started", description: `Region: ${region === 'none' ? 'N/A' : region}, Language: ${language}` });
    } else {
      setChatSessions(prev =>
        prev.map(session =>
          session.id === targetSessionId
            ? { ...session, messages: [...session.messages, userMessage] }
            : session
        )
      );
    }

    // Simulate bot reply
    setTimeout(() => {
      const botReplyText = language === 'fr'
        ? `Réponse du bot à : "${text.substring(0,20)}..." (Région: ${region === 'none' ? 'Aucune' : region})`
        : `Bot response to: "${text.substring(0,20)}..." (Region: ${region === 'none' ? 'N/A' : region})`;

      const botMessage: ChatMessage = {
        id: uuidv4(),
        sender: 'bot',
        text: botReplyText,
        timestamp: new Date(),
      };
      
      setChatSessions(prev =>
        prev.map(session =>
          session.id === targetSessionId
            ? { ...session, messages: [...session.messages, botMessage] }
            : session
        )
      );
      setIsBotLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <HeaderBar
        showHistory={showHistory}
        onToggleHistory={handleToggleHistory}
        selectedRegion={region}
        onRegionChange={setRegion}
        currentLanguage={language}
        onLanguageChange={setLanguage}
      />
      <main className="flex flex-row flex-grow overflow-hidden">
        <div className="flex-grow h-full">
          <ChatArea
            messages={currentMessages}
            onSendMessage={handleSendMessage}
            currentLanguage={language}
            isLoading={isBotLoading}
          />
        </div>
        {showHistory && (
          <HistoryPanel
            sessions={chatSessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
          />
        )}
      </main>
      <Toaster />
    </div>
  );
}
