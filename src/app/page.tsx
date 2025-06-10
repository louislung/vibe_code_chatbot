
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
    id: `hist-${uuidv4()}`,
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
    id: `hist-${uuidv4()}`,
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
  
  const [activeLiveSessionId, setActiveLiveSessionId] = useState<string | null>(null);
  const [currentViewSessionId, setCurrentViewSessionId] = useState<string | null>(null);

  const [isBotLoading, setIsBotLoading] = useState(false); // Used for bot replies and WS connection attempts
  const { toast } = useToast();

  const socketRef = useRef<WebSocket | null>(null);
  const [pendingMessageForSend, setPendingMessageForSend] = useState<{ text: string } | null>(null);


  const connectWebSocket = (connectRegion: Region | 'none', connectLanguage: Language) => {
    if (IS_MOCK_API) {
      console.log("Mock mode: connectWebSocket called.");
      setIsBotLoading(true); // Indicates connection attempt or bot action
      const mockLiveId = `mock-live-${uuidv4()}`;
      const newMockLiveSession: ChatSession = {
        id: mockLiveId,
        startTime: new Date(),
        region: connectRegion,
        language: connectLanguage,
        messages: [],
        title: `New Chat (${connectRegion === 'none' ? 'No Region' : connectRegion}, ${connectLanguage})`,
      };
      
      setChatSessions(prev => {
        const sessionsWithoutOldEmptyLive = prev.filter(s => !(s.id === activeLiveSessionId && s.messages.length === 0));
        return [newMockLiveSession, ...sessionsWithoutOldEmptyLive].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      });
      setActiveLiveSessionId(mockLiveId);
      setCurrentViewSessionId(mockLiveId);
      setIsBotLoading(false); // Mock connection is "instant"

      if (pendingMessageForSend) {
        console.log(`Mock: Processing pending message for new session ${mockLiveId}: ${pendingMessageForSend.text}`);
        // Simulate sending this pending message. handleSendMessage will set isBotLoading again.
        handleSendMessage(pendingMessageForSend.text, true); 
        setPendingMessageForSend(null);
      }
      return;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        socketRef.current.close();
    }
    socketRef.current = null;
    setIsBotLoading(true); // Attempting to connect
  
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;
    const wsUrl = `ws//localhost:9001/api/ws`; // Ensure this matches your backend

    console.log(`Attempting to connect WebSocket to ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws; 
  
    ws.onopen = () => {
      console.log('WebSocket connection established. Waiting for InitiateConversationResponse.');
      // Server is expected to send InitiateConversationResponse automatically.
      // isBotLoading remains true until InitiateConversationResponse or error.
    };
  
    ws.onmessage = (event) => {
      try {
        const serverMessage = JSON.parse(event.data as string);
        console.log('WebSocket message received:', serverMessage);
  
        if (serverMessage.type === 'InitiateConversationResponse') {
          const newConversationId = serverMessage.data.conversation_id;
          
          const newLiveSession: ChatSession = {
            id: newConversationId,
            startTime: new Date(),
            region: connectRegion,
            language: connectLanguage,
            messages: [],
            title: `New Chat (${connectRegion === 'none' ? 'No Region' : connectRegion}, ${connectLanguage})`,
          };

          if (pendingMessageForSend) {
            const userMessageForPending: ChatMessage = {
              id: uuidv4(),
              sender: 'user',
              text: pendingMessageForSend.text,
              timestamp: new Date(),
            };
            newLiveSession.messages.push(userMessageForPending);
            if (newLiveSession.messages.length === 1) { // Set title from first message
                 newLiveSession.title = pendingMessageForSend.text.substring(0,30) + (pendingMessageForSend.text.length > 30 ? '...' : '');
            }
          }

          setChatSessions(prev => {
            const sessionsWithoutOldEmptyLive = prev.filter(s => !(s.id === activeLiveSessionId && s.messages.length === 0));
            return [newLiveSession, ...sessionsWithoutOldEmptyLive].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          });
          setActiveLiveSessionId(newConversationId);
          setCurrentViewSessionId(newConversationId);
          // If no pending message, connection is ready and not waiting for a reply yet.
          // If there IS a pending message, it will be sent, and isBotLoading should remain true.
          setIsBotLoading(!!pendingMessageForSend); 

          if (pendingMessageForSend) {
            console.log(`Processing pending message for new session ${newConversationId}: ${pendingMessageForSend.text}`);
            socketRef.current?.send(JSON.stringify({
              type: 'SubmitQuestionRequest',
              data: { question: pendingMessageForSend.text, region: newLiveSession.region }
            }));
            // isBotLoading is already true from the logic above.
            setPendingMessageForSend(null);
          }
  
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
              session.id === activeLiveSessionId 
                ? { ...session, messages: [...session.messages, botMessage] }
                : session
            )
          );
          setIsBotLoading(false); // Bot has replied
  
        } else if (serverMessage.type === 'Error') {
          toast({
            title: `Server Error (Code: ${serverMessage.data.code})`,
            description: serverMessage.data.message,
            variant: 'destructive',
          });
          setIsBotLoading(false);
          if (pendingMessageForSend) setPendingMessageForSend(null); 
        }
      } catch (error) {
        console.error('Failed to parse or handle WebSocket message:', error);
        toast({ title: 'Processing Error', description: 'Received malformed data from server.', variant: 'destructive' });
        setIsBotLoading(false);
        if (pendingMessageForSend) setPendingMessageForSend(null);
      }
    };
  
    ws.onerror = (errorEvent) => {
      console.error('WebSocket error:', errorEvent);
      toast({ title: 'WebSocket Connection Error', description: 'Could not connect to the chat server.', variant: 'destructive' });
      setIsBotLoading(false);
      setActiveLiveSessionId(null); 
      if (pendingMessageForSend) setPendingMessageForSend(null); // Clear pending if connection fails
      if (socketRef.current === ws) { 
          socketRef.current = null;
      }
    };
  
    ws.onclose = (closeEvent) => {
      console.log('WebSocket connection closed:', closeEvent.code, closeEvent.reason);
      if (socketRef.current === ws) { 
        socketRef.current = null;
      }
      // If there was a pending message and the close was unexpected, stop loading.
      if (pendingMessageForSend && (closeEvent.code !== 1000 && !closeEvent.wasClean)) {
        setIsBotLoading(false);
        // Don't clear pendingMessageForSend here, user might retry or connect again.
        toast({ title: 'Connection Closed', description: 'Chat disconnected. Please try sending your message again.', variant: 'warning' });
      } else if (!activeLiveSessionId && !IS_MOCK_API) { // If no active session was ever established.
        setIsBotLoading(false);
      }
    };
  };
  
  useEffect(() => {
    if (typeof window !== 'undefined') { 
        console.log("Initial effect: IS_MOCK_API:", IS_MOCK_API, "activeLiveSessionId:", activeLiveSessionId);
        if (!activeLiveSessionId && !socketRef.current) { 
            connectWebSocket(region, language);
        }
    }
    
    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        socketRef.current.close(1000, "Component unmounting");
      }
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const currentMessages = useMemo(() => {
    if (!currentViewSessionId) return [];
    const session = chatSessions.find(s => s.id === currentViewSessionId);
    return session ? session.messages : [];
  }, [currentViewSessionId, chatSessions]);

  const handleToggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentViewSessionId(sessionId);
  };
  
  useEffect(() => {
    if (!currentViewSessionId && chatSessions.length > 0) {
        const sortedSessions = [...chatSessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        if (sortedSessions.length > 0) {
            const latestSessionId = activeLiveSessionId || sortedSessions[0].id;
            setCurrentViewSessionId(latestSessionId);
        }
    } else if (currentViewSessionId && !chatSessions.find(s => s.id === currentViewSessionId)) {
        const newTarget = activeLiveSessionId || (chatSessions.length > 0 ? chatSessions.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0].id : null);
        setCurrentViewSessionId(newTarget);
    }
  }, [chatSessions, currentViewSessionId, activeLiveSessionId]);


  const handleRegionLanguageChange = (newRegion: Region | 'none', newLanguage: Language) => {
    const oldLiveSession = chatSessions.find(s => s.id === activeLiveSessionId);
    if (oldLiveSession && oldLiveSession.messages.length === 0) {
        setChatSessions(prev => prev.filter(s => s.id !== activeLiveSessionId));
    }
    
    setRegion(newRegion);
    setLanguage(newLanguage);
    setActiveLiveSessionId(null); // Indicate previous session is no longer "live" for new messages
    if (pendingMessageForSend) {
        // If a message was pending, and user changes region/lang, it's best to clear it or notify user.
        // For now, let's clear it and let them re-send if they wish.
        setPendingMessageForSend(null);
        toast({ title: "Action Interrupted", description: "Region/language changed. Please resend your message if needed.", variant: "default"});
    }
    connectWebSocket(newRegion, newLanguage); // This will set new activeLiveSessionId
  };


  const handleSendMessage = (text: string, isProcessingPending: boolean = false) => {
    if (!isProcessingPending) { 
        setIsBotLoading(true); // Set loading for a new user message.
    }

    if (IS_MOCK_API) {
      if (!activeLiveSessionId) {
        console.warn("Mock mode: No activeLiveSessionId. Attempting to connect and queue message.");
        if (!pendingMessageForSend && !isProcessingPending) setPendingMessageForSend({ text });
        connectWebSocket(region, language); 
        // User message will be added by the pending flow in connectWebSocket -> handleSendMessage(..., true)
        return;
      }

      const userMessage: ChatMessage = {
        id: uuidv4(),
        sender: 'user',
        text,
        timestamp: new Date(),
      };

      setChatSessions(prev =>
        prev.map(s =>
          s.id === activeLiveSessionId
            ? { ...s, messages: [...s.messages, userMessage], title: (s.messages.length === 0 && !s.title.startsWith("New Chat")) ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : s.title }
            : s
        )
      );
      setCurrentViewSessionId(activeLiveSessionId); 

      // Simulate bot reply
      setTimeout(() => {
        const questionId = uuidv4();
        const mockSessionDetails = chatSessions.find(s=>s.id===activeLiveSessionId);
        const mockAnswerHtml = `
          <p>Mock answer for "${text}" in region ${mockSessionDetails?.region || 'N/A'} (Session: ${activeLiveSessionId}, QID: ${questionId}). The guidelines for underwriting hotels include the follow: abcdefg</p>
          <p><strong>Sources:</strong></p>
          <ul><li><a href="http://www.google.com/" target="_blank" rel="noopener noreferrer">Lodging</a> (Document, Score: 0.5, File: /tmp/tmp.html)</li></ul>
          <p><strong>Other Related:</strong></p>
          <ul><li><a href="http://intactfc.com/" target="_blank" rel="noopener noreferrer">Intact Insurance</a> (Document, Score: 0.678, File: /tmp/tmp2.html)</li></ul>`;

        const botMessage: ChatMessage = { id: questionId, sender: 'bot', text: mockAnswerHtml, timestamp: new Date() };
        setChatSessions(prev =>
          prev.map(s =>
            s.id === activeLiveSessionId ? { ...s, messages: [...s.messages, botMessage] } : s
          )
        );
        setIsBotLoading(false);
      }, 1000);
      return;
    }

    // Real WebSocket logic
    if (!activeLiveSessionId && !isProcessingPending) { // Message sent before initial connection fully established
      toast({ title: "Connecting...", description: "Establishing chat session. Your message will be sent shortly.", variant: "default" });
      if (!pendingMessageForSend) setPendingMessageForSend({ text }); 
      // connectWebSocket should already be in progress from useEffect or prior attempt. If not, this might be an issue.
      // Let's ensure a connection attempt is running if we queue a message here.
      if (!socketRef.current || (socketRef.current.readyState !== WebSocket.OPEN && socketRef.current.readyState !== WebSocket.CONNECTING)) {
        connectWebSocket(region, language);
      }
      // User message is NOT added optimistically here for real WS if no active session. It's handled by InitiateConversationResponse if pending.
      // isBotLoading is already true.
      return;
    }
    
    // If this is not a pending message being processed, add user message optimistically
    if (!isProcessingPending) {
        const userMessage: ChatMessage = {
            id: uuidv4(),
            sender: 'user',
            text,
            timestamp: new Date(),
        };
        setChatSessions(prev =>
            prev.map(s =>
            s.id === activeLiveSessionId
                ? { ...s, messages: [...s.messages, userMessage], title: (s.messages.length === 0 && !s.title.startsWith("New Chat")) ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : s.title }
                : s
            )
        );
        setCurrentViewSessionId(activeLiveSessionId); 
    }


    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      if (!isProcessingPending && !pendingMessageForSend) { // If not already pending, make it pending
        setPendingMessageForSend({ text });
         toast({ title: "Reconnecting...", description: "Connection issue. Trying to send your message.", variant: "default" });
      }
      if (socketRef.current?.readyState === WebSocket.CONNECTING) {
        console.log("Socket connecting, message already queued or will be sent on open by InitiateConversationResponse.");
        // isBotLoading is already true.
        return;
      }
      console.log("Socket not open, attempting to reconnect to send message.");
      const currentSessionForReconnect = chatSessions.find(s => s.id === activeLiveSessionId);
      connectWebSocket(currentSessionForReconnect?.region || region, currentSessionForReconnect?.language || language);
      // isBotLoading is already true.
      return;
    }

    const currentLiveSession = chatSessions.find(s => s.id === activeLiveSessionId);
    if (!currentLiveSession) {
        toast({ title: "Error", description: "Active session details not found.", variant: "destructive"});
        setIsBotLoading(false);
        return;
    }

    socketRef.current.send(JSON.stringify({
      type: 'SubmitQuestionRequest',
      data: { question: text, region: currentLiveSession.region }
    }));
    // isBotLoading is already true.
  };

  const isInputAreaDisabled = useMemo(() => {
    if (IS_MOCK_API && !activeLiveSessionId && pendingMessageForSend) return false; // Allow typing if mock and pending first message
    if (IS_MOCK_API) return isBotLoading; 
    
    // For real WS:
    // Disable if bot is loading (either connecting or replying)
    // OR if there's no active live session established yet (e.g. initial connection failed or ongoing)
    // OR if the user is viewing a historical session.
    return isBotLoading || !activeLiveSessionId || (currentViewSessionId !== activeLiveSessionId);
  }, [isBotLoading, activeLiveSessionId, currentViewSessionId, pendingMessageForSend]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <HeaderBar
        showHistory={showHistory}
        onToggleHistory={handleToggleHistory}
        selectedRegion={region}
        onRegionChange={(newRegion) => {
          handleRegionLanguageChange(newRegion, language);
        }}
        currentLanguage={language}
        onLanguageChange={(newLang) => {
          handleRegionLanguageChange(region, newLang);
        }}
      />
      <main className="flex flex-row flex-grow overflow-hidden">
        <div className="flex-grow h-full">
          <ChatArea
            messages={currentMessages}
            onSendMessage={handleSendMessage}
            currentLanguage={language} 
            isLoading={isBotLoading} 
            isInputDisabled={isInputAreaDisabled} 
          />
        </div>
        {showHistory && (
          <HistoryPanel
            sessions={chatSessions}
            currentSessionId={currentViewSessionId} 
            activeLiveSessionId={activeLiveSessionId} 
            onSelectSession={handleSelectSession}
          />
        )}
      </main>
      <Toaster />
    </div>
  );
}

