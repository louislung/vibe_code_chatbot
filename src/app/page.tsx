
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { HeaderBar } from "@/components/chat/HeaderBar";
import { ChatArea } from "@/components/chat/ChatArea";
import { HistoryPanel } from "@/components/chat/HistoryPanel";
import type { ChatSession, ChatMessage, Region, Language } from "@/lib/types";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

const IS_MOCK_API = process.env.NEXT_PUBLIC_MOCK_API === 'true';

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

  useEffect(() => {
    if (IS_MOCK_API) {
      console.log("Running in MOCK API mode.");
    }
  }, []);

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
    }
  };
  
  useEffect(() => {
    if (!currentSessionId && chatSessions.length > 0) {
        const sortedSessions = [...chatSessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        if (sortedSessions.length > 0) {
            const latestSession = sortedSessions[0];
            // In mock mode, if latest session is not a mock session, don't auto-select for interaction to avoid confusion.
            // User must send a message to start a mock interaction.
            if (IS_MOCK_API && latestSession && !latestSession.id.startsWith('mock-')) {
                // Do not auto-select non-mock historical sessions in mock mode for active chat
            } else {
                 setCurrentSessionId(latestSession.id);
            }
        }
    }
  }, [chatSessions, currentSessionId]);


  const connectWebSocket = () => {
    if (IS_MOCK_API) {
      console.log('Mock mode: connectWebSocket called. Actual connection handled by mock logic in handleSendMessage.');
      // If a pending message was set (which happens before connectWebSocket is called),
      // the mock handleSendMessage will simulate the bot's response including "initiation".
      // No direct action needed here for mock mode as handleSendMessage orchestrates the mock flow.
      return;
    }
  
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;
  
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws; 
  
    ws.onopen = () => {
      console.log('WebSocket connection established');
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
      if (socketRef.current === ws) { 
          socketRef.current = null;
      }
    };
  
    ws.onclose = (closeEvent) => {
      console.log('WebSocket connection closed:', closeEvent.code, closeEvent.reason);
      if (closeEvent.code !== 1000 && closeEvent.code !== 1005 && !closeEvent.wasClean) { 
        // toast({ title: 'WebSocket Closed Unexpectedly', description: `Code: ${closeEvent.code}`, variant: 'warning' });
      }
      setIsBotLoading(false);
      if (pendingMessage && socketRef.current !== ws) { 
      } else if (pendingMessage) {
        setPendingMessage(null);
      }
      if (socketRef.current === ws) { 
        socketRef.current = null;
      }
    };
  };

  useEffect(() => {
    return () => {
      if (socketRef.current && !IS_MOCK_API) {
        if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        }
        socketRef.current.close();
        socketRef.current = null;
      } else if (IS_MOCK_API) {
        console.log("Mock WebSocket: unmounting, no real connection to close.");
      }
    };
  }, []);

  const handleSendMessage = (text: string) => {
    setIsBotLoading(true);

    if (IS_MOCK_API) {
      const userMessage: ChatMessage = {
        id: uuidv4(),
        sender: 'user',
        text,
        timestamp: new Date(),
      };

      let targetSessionId = currentSessionId;
      let isNewMockConversation = false;
      const existingSession = currentSessionId ? chatSessions.find(s => s.id === currentSessionId) : null;

      // Determine if this is a new mock conversation or continuation of an existing mock one
      if (!existingSession || !existingSession.id.startsWith('mock-')) {
        isNewMockConversation = true;
        targetSessionId = `mock-${uuidv4()}`; // Always create a new ID for a new mock interaction flow
      }
      // If existingSession.id starts with 'mock-', targetSessionId is already correct.

      if (isNewMockConversation) {
        console.log(`Mock: Starting new conversation flow. Conversation ID will be ${targetSessionId}. Simulating InitiateConversationResponse.`);
        // Simulate adding the user message to a new session
        const newMockSession: ChatSession = {
          id: targetSessionId!, // Assert targetSessionId is not null
          startTime: new Date(),
          language: language, // Use current global language
          region: region,     // Use current global region
          messages: [userMessage],
          title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
        };
        setChatSessions(prev => [newMockSession, ...prev].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
        setCurrentSessionId(targetSessionId!);
      } else {
        // Add user message to existing mock session
        setChatSessions(prev =>
          prev.map(session =>
            session.id === targetSessionId
              ? { ...session, messages: [...session.messages, userMessage] }
              : session
          )
        );
      }
      
      // Simulate bot response after a delay
      setTimeout(() => {
        const questionId = uuidv4();
        const mockAnswerHtml = `
          <p>Mock answer for "${text}" in region ${region === 'none' ? 'not specified' : region} (Session: ${targetSessionId}, Message: ${questionId}). The guidelines for underwriting hotels include the follow: abcdefg</p>
          <p><strong>Sources:</strong></p>
          <ul>
            <li>
              <a href="http://www.google.com/" target="_blank" rel="noopener noreferrer">Lodging</a>
              (Document, Score: 0.5, File: /tmp/tmp.html)
            </li>
          </ul>
          <p><strong>Other Related:</strong></p>
          <ul>
            <li>
              <a href="http://intactfc.com/" target="_blank" rel="noopener noreferrer">Intact Insurance</a>
              (Document, Score: 0.678, File: /tmp/tmp2.html)
            </li>
          </ul>`;

        const botMessage: ChatMessage = {
          id: questionId, 
          sender: 'bot',
          text: mockAnswerHtml, 
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
        console.log(`Mock: SubmitQuestionResponse sent for question in session ${targetSessionId}.`);
      }, 1000 + (isNewMockConversation ? 300 : 0)); // Slightly longer delay if "initiating"

      return; // End of mock logic
    }

    // Real WebSocket logic from here
    const currentActiveSession = chatSessions.find(s => s.id === currentSessionId);
    const isSocketOpenAndValidForCurrentSession = 
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      currentActiveSession &&
      currentActiveSession.messages.some(m => m.sender === 'bot');


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
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        socketRef.current.close(); 
      }
      socketRef.current = null; 

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
        language, 
        region,   
        messages: [userMessageForNewChatUI],
        title: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      };
  
      setChatSessions(prev => [newTempSession, ...prev].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setCurrentSessionId(tempSessionId);
  
      setPendingMessage({ text, region, language, tempSessionId });
      connectWebSocket(); 
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
