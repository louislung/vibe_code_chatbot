
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { HeaderBar } from "@/components/chat/HeaderBar";
import { ChatArea } from "@/components/chat/ChatArea";
import { HistoryPanel } from "@/components/chat/HistoryPanel";
import type { ChatSession, ChatMessage, Region, Language } from "@/lib/types";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

// Mock initial data - these are historical, view-only unless a new chat is started
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

  const socketRef = useRef<WebSocket | null>(null);
  const [pendingMessage, setPendingMessage] = useState<{ text: string; region: Region | 'none'; language: Language, tempSessionId: string } | null>(null);

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
      // If switching to a session that had an active websocket, we might want to close it
      // as new messages will start a new WebSocket conversation.
      // For now, selecting history is view-only. A new message always implies a new WebSocket interaction if not already on one.
    }
  };
  
  useEffect(() => {
    // Select the latest session if no current session is selected and sessions exist
    if (!currentSessionId && chatSessions.length > 0) {
        const sortedSessions = [...chatSessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        if (sortedSessions.length > 0) {
            setCurrentSessionId(sortedSessions[0].id);
        }
    }
  }, [chatSessions, currentSessionId]);


  const connectWebSocket = () => {
    // setIsBotLoading(true); // Moved to handleSendMessage to ensure UI updates before connection attempt
  
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    // For local dev with backend on different port, e.g.: const wsUrl = `ws://localhost:8000/ws`;
  
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws; // Assign early to prevent race conditions with onclose
  
    ws.onopen = () => {
      console.log('WebSocket connection established');
      // Server should automatically send InitiateConversationResponse
    };
  
    ws.onmessage = (event) => {
      try {
        const serverMessage = JSON.parse(event.data as string);
  
        if (serverMessage.type === 'InitiateConversationResponse') {
          const newConversationId = serverMessage.data.conversation_id;
          
          if (!pendingMessage || !pendingMessage.tempSessionId) {
            console.error("InitiateConversationResponse received, but no pending message/tempSessionId.");
            setIsBotLoading(false);
            ws.close(); 
            return;
          }
  
          const { text: firstUserMessageText, region: chatRegion, tempSessionId, language: chatLanguage } = pendingMessage;
          
          setChatSessions(prev => prev.map(session => 
            session.id === tempSessionId 
              ? { ...session, id: newConversationId, region: chatRegion, language: chatLanguage } 
              : session
          ).sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
          
          setCurrentSessionId(newConversationId);
          
          ws.send(JSON.stringify({
            type: 'SubmitQuestionRequest',
            data: { question: firstUserMessageText, region: chatRegion }
          }));
          setPendingMessage(null);
  
        } else if (serverMessage.type === 'SubmitQuestionResponse') {
          const { question_id, answer } = serverMessage.data;
          const botMessage: ChatMessage = {
            id: question_id || uuidv4(), 
            sender: 'bot',
            text: answer, 
            timestamp: new Date(),
          };
          setChatSessions(prev =>
            prev.map(session =>
              session.id === currentSessionId 
                ? { ...session, messages: [...session.messages, botMessage] }
                : session
            )
          );
          setIsBotLoading(false);
  
        } else if (serverMessage.type === 'Error') {
          toast({
            title: `Server Error (Code: ${serverMessage.data.code})`,
            description: serverMessage.data.message,
            variant: 'destructive',
          });
          setIsBotLoading(false);
          if (pendingMessage) setPendingMessage(null); 
        }
      } catch (error) {
        console.error('Failed to parse or handle WebSocket message:', error);
        toast({ title: 'Processing Error', description: 'Received malformed data from server.', variant: 'destructive' });
        setIsBotLoading(false);
        if (pendingMessage) setPendingMessage(null);
      }
    };
  
    ws.onerror = (errorEvent) => {
      console.error('WebSocket error:', errorEvent);
      toast({ title: 'WebSocket Connection Error', variant: 'destructive' });
      setIsBotLoading(false);
      if (pendingMessage) setPendingMessage(null);
      if (socketRef.current === ws) { // Check if it's the current socket
          socketRef.current = null;
      }
    };
  
    ws.onclose = (closeEvent) => {
      console.log('WebSocket connection closed:', closeEvent.code, closeEvent.reason);
      // Only show toast for unexpected closures.
      if (closeEvent.code !== 1000 && closeEvent.code !== 1005 && !closeEvent.wasClean) { 
        // toast({ title: 'WebSocket Closed Unexpectedly', description: `Code: ${closeEvent.code}`, variant: 'warning' });
      }
      setIsBotLoading(false);
      if (pendingMessage && socketRef.current !== ws) { 
        // If pending message exists and this onclose is for an old socket, do not clear the pending message for the new one.
      } else if (pendingMessage) {
        // If it's the current socket or no specific check, clear if pending.
        setPendingMessage(null);
      }
      if (socketRef.current === ws) { // Only clear if it's the current socket closing
        socketRef.current = null;
      }
    };
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        }
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = (text: string) => {
    setIsBotLoading(true); // Set loading true at the beginning of send action

    const currentActiveSession = chatSessions.find(s => s.id === currentSessionId);
    // Check if the socket is open and currentSessionId matches an actual session that has server interaction (e.g. bot messages)
    const isSocketOpenAndValidForCurrentSession = 
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      currentActiveSession &&
      currentActiveSession.messages.some(m => m.sender === 'bot'); // A simple heuristic: if a bot has replied, it's server-backed


    if (isSocketOpenAndValidForCurrentSession && currentActiveSession) {
      const userMessage: ChatMessage = {
        id: uuidv4(),
        sender: 'user',
        text,
        timestamp: new Date(),
      };
      setChatSessions(prev =>
        prev.map(session =>
          session.id === currentSessionId
            ? { ...session, messages: [...session.messages, userMessage] }
            : session
        )
      );
      socketRef.current?.send(JSON.stringify({
        type: 'SubmitQuestionRequest',
        data: { question: text, region: currentActiveSession.region }
      }));
    } else {
      // This is a new conversation or continuing a view-only historical chat
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        console.log("Closing stale/previous WebSocket connection.");
        socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        socketRef.current.close(); // Intentionally close previous before making new
      }
      socketRef.current = null; // Ensure ref is cleared before new connection

      const tempSessionId = uuidv4();
      const userMessageForNewChatUI: ChatMessage = {
        id: uuidv4(),
        sender: 'user',
        text,
        timestamp: new Date(),
      };
      const newTempSession: ChatSession = {
        id: tempSessionId,
        startTime: new Date(),
        language, // Use current global language from header
        region,   // Use current global region from header
        messages: [userMessageForNewChatUI],
        title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      };
  
      setChatSessions(prev => [newTempSession, ...prev].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setCurrentSessionId(tempSessionId);
  
      setPendingMessage({ text, region, language, tempSessionId });
      // setIsBotLoading(true); // Already set at the start of function
      connectWebSocket(); // This will handle the rest
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <HeaderBar
        showHistory={showHistory}
        onToggleHistory={handleToggleHistory}
        selectedRegion={region}
        onRegionChange={(newRegion) => {
          setRegion(newRegion);
        }}
        currentLanguage={language}
        onLanguageChange={(newLang) => {
          setLanguage(newLang);
        }}
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

    