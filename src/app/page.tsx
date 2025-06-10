
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
      setIsBotLoading(true);
      const mockLiveId = `mock-live-${uuidv4()}`;
      const newMockLiveSession: ChatSession = {
        id: mockLiveId,
        startTime: new Date(),
        region: connectRegion,
        language: connectLanguage,
        messages: [],
        title: `New Chat (${connectRegion === 'none' ? 'No Region' : connectRegion}, ${connectLanguage})`,
      };
      
      // If there was an old live session with messages, keep it. Otherwise, it might be replaced.
      setChatSessions(prev => {
        const sessionsWithoutOldEmptyLive = prev.filter(s => !(s.id === activeLiveSessionId && s.messages.length === 0));
        return [newMockLiveSession, ...sessionsWithoutOldEmptyLive].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      });
      setActiveLiveSessionId(mockLiveId);
      setCurrentViewSessionId(mockLiveId);
      setIsBotLoading(false);

      if (pendingMessageForSend) {
        console.log(`Mock: Processing pending message for new session ${mockLiveId}: ${pendingMessageForSend.text}`);
        // Simulate sending this pending message
        handleSendMessage(pendingMessageForSend.text, true); // Pass a flag to avoid re-queueing
        setPendingMessageForSend(null);
      }
      return;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        socketRef.current.close();
    }
    socketRef.current = null;
    setIsBotLoading(true);
  
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;
  
    console.log(`Attempting to connect WebSocket to ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws; 
  
    ws.onopen = () => {
      console.log('WebSocket connection established. Waiting for InitiateConversationResponse.');
      // Server is expected to send InitiateConversationResponse automatically.
      // If a message was pending because send was clicked before socket fully ready (after InitiateConversationResponse)
      // it will be handled once InitiateConversationResponse sets activeLiveSessionId.
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

          setChatSessions(prev => {
            const sessionsWithoutOldEmptyLive = prev.filter(s => !(s.id === activeLiveSessionId && s.messages.length === 0));
            return [newLiveSession, ...sessionsWithoutOldEmptyLive].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          });
          setActiveLiveSessionId(newConversationId);
          setCurrentViewSessionId(newConversationId);
          setIsBotLoading(false); // Connection is ready, not waiting for a message reply yet

          if (pendingMessageForSend) {
            console.log(`Processing pending message for new session ${newConversationId}: ${pendingMessageForSend.text}`);
            // The user message for pendingMessageForSend would have already been added optimistically.
            // We just need to send it to the server.
            socketRef.current?.send(JSON.stringify({
              type: 'SubmitQuestionRequest',
              data: { question: pendingMessageForSend.text, region: connectRegion }
            }));
            // isBotLoading is already true from handleSendMessage if pendingMessageForSend was set.
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
              session.id === activeLiveSessionId // Bot responses always go to the active live session
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
      setActiveLiveSessionId(null); // Indicate no active connection
      if (pendingMessageForSend) setPendingMessageForSend(null);
      if (socketRef.current === ws) { 
          socketRef.current = null;
      }
    };
  
    ws.onclose = (closeEvent) => {
      console.log('WebSocket connection closed:', closeEvent.code, closeEvent.reason);
      if (closeEvent.code !== 1000 && closeEvent.code !== 1005 && !closeEvent.wasClean) { 
         // toast({ title: 'WebSocket Closed Unexpectedly', description: `Code: ${closeEvent.code}`, variant: 'warning' });
      }
      // Don't set activeLiveSessionId to null here unless it was an error,
      // as it might be a clean close before a new connection (e.g. region change)
      //setIsBotLoading(false); // Only if it was an unexpected close
      if (socketRef.current === ws) { 
        socketRef.current = null;
      }
       if (pendingMessageForSend && !socketRef.current) { // If still pending and socket is truly gone
        setIsBotLoading(false);
        // setPendingMessageForSend(null); // Keep it, user might retry
      }
    };
  };
  
  // Effect for initial connection and cleanup
  useEffect(() => {
    if (typeof window !== 'undefined') { // Ensure running on client
        console.log("Initial effect: IS_MOCK_API:", IS_MOCK_API, "activeLiveSessionId:", activeLiveSessionId);
        if (!activeLiveSessionId) { // Connect only if no active session yet
            connectWebSocket(region, language);
        }
    }
    
    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'Close', data: {} }));
        socketRef.current.close();
      }
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty: connect once on mount. Region/lang changes handled separately.


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
  
  // Auto-select the latest session (which should be the live one if available) for view if nothing is selected.
  useEffect(() => {
    if (!currentViewSessionId && chatSessions.length > 0) {
        const sortedSessions = [...chatSessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        if (sortedSessions.length > 0) {
            const latestSessionId = activeLiveSessionId || sortedSessions[0].id;
            setCurrentViewSessionId(latestSessionId);
        }
    } else if (currentViewSessionId && !chatSessions.find(s => s.id === currentViewSessionId)) {
        // If currentViewSessionId points to a session that no longer exists (e.g. after filtering), select active or latest
        const newTarget = activeLiveSessionId || (chatSessions.length > 0 ? chatSessions.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0].id : null);
        setCurrentViewSessionId(newTarget);
    }
  }, [chatSessions, currentViewSessionId, activeLiveSessionId]);


  const handleRegionLanguageChange = (newRegion: Region | 'none', newLanguage: Language) => {
    setRegion(newRegion);
    setLanguage(newLanguage);
    // Preserve old live session in history if it had messages
    const oldLiveSession = chatSessions.find(s => s.id === activeLiveSessionId);
    if (oldLiveSession && oldLiveSession.messages.length === 0) {
        setChatSessions(prev => prev.filter(s => s.id !== activeLiveSessionId));
    }
    setActiveLiveSessionId(null); // Force new connection
    connectWebSocket(newRegion, newLanguage);
  };


  const handleSendMessage = (text: string, isProcessingPending: boolean = false) => {
    if (!isProcessingPending) { // For normal sends, set loading. For pending, it's already loading.
        setIsBotLoading(true);
    }

    if (IS_MOCK_API) {
      if (!activeLiveSessionId) {
        console.error("Mock mode: No activeLiveSessionId to send message to.");
        // Attempt to re-establish mock session if lost
        connectWebSocket(region, language); 
        // Queue message
        if (!pendingMessageForSend) setPendingMessageForSend({ text });
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
            ? { ...s, messages: [...s.messages, userMessage], title: (s.messages.length === 0 && !s.title.startsWith("Live Chat")) || s.messages.length === 0 ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : s.title }
            : s
        )
      );
      setCurrentViewSessionId(activeLiveSessionId); // Ensure view focuses on live session

      setTimeout(() => {
        const questionId = uuidv4();
        const mockAnswerHtml = `
          <p>Mock answer for "${text}" in region ${chatSessions.find(s=>s.id===activeLiveSessionId)?.region || 'N/A'} (Session: ${activeLiveSessionId}, Message: ${questionId}). The guidelines for underwriting hotels include the follow: abcdefg</p>
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
    if (!activeLiveSessionId) {
      toast({ title: "Connection Issue", description: "No active chat session. Trying to connect...", variant: "default" });
      if (!isProcessingPending && !pendingMessageForSend) setPendingMessageForSend({ text }); // Queue if not already processing a pending one
      connectWebSocket(region, language); // Attempt to establish connection
      // User message is not added optimistically here, will be added by pending logic if connection succeeds
      return;
    }
    
    // Optimistically add user message only if not already processing a pending one that did this
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
                ? { ...s, messages: [...s.messages, userMessage], title: (s.messages.length === 0 && !s.title.startsWith("Live Chat")) || s.messages.length === 0 ? text.substring(0, 30) + (text.length > 30 ? '...' : '') : s.title }
                : s
            )
        );
        setCurrentViewSessionId(activeLiveSessionId); // Focus on live session
    }


    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      if (!isProcessingPending && !pendingMessageForSend) {
        setPendingMessageForSend({ text });
      }
      // If socket is connecting, message is queued and will be sent on open if InitiateConversationResponse is successful
      if (socketRef.current?.readyState === WebSocket.CONNECTING) {
        console.log("Socket connecting, message queued.");
        return;
      }
      // If socket is closed or null, try to reconnect
      console.log("Socket not open, attempting to reconnect and send pending message.");
      connectWebSocket(chatSessions.find(s => s.id === activeLiveSessionId)?.region || region, chatSessions.find(s => s.id === activeLiveSessionId)?.language || language);
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
  };

  const isInputAreaDisabled = useMemo(() => {
    if (IS_MOCK_API) return isBotLoading; // In mock mode, input is enabled unless bot is "typing"
    return isBotLoading || !activeLiveSessionId || (currentViewSessionId !== activeLiveSessionId);
  }, [isBotLoading, activeLiveSessionId, currentViewSessionId]);

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
            currentLanguage={language} // For placeholder text
            isLoading={isBotLoading} // For "Bot is typing..."
            isInputDisabled={isInputAreaDisabled} // To disable input field
          />
        </div>
        {showHistory && (
          <HistoryPanel
            sessions={chatSessions}
            currentSessionId={currentViewSessionId} // Highlight based on view
            activeLiveSessionId={activeLiveSessionId} // Could be used for special styling for live
            onSelectSession={handleSelectSession}
          />
        )}
      </main>
      <Toaster />
    </div>
  );
}
