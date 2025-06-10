
"use client";

import type { ChatSession } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { MessageSquareText, CalendarDays, Zap } from "lucide-react"; // Added Zap for live
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  sessions: ChatSession[];
  currentSessionId: string | null; // This is currentViewSessionId
  activeLiveSessionId: string | null; // To identify the live session
  onSelectSession: (sessionId: string) => void;
}

export function HistoryPanel({ sessions, currentSessionId, activeLiveSessionId, onSelectSession }: HistoryPanelProps) {
  const sortedSessions = [...sessions].sort((a, b) => {
    // Prioritize live session if it exists, then sort by time
    if (a.id === activeLiveSessionId && b.id !== activeLiveSessionId) return -1;
    if (b.id === activeLiveSessionId && a.id !== activeLiveSessionId) return 1;
    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });

  return (
    <div className="w-72 border-l bg-history-panel-background flex flex-col h-full shadow-lg">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-foreground">Chat History</h2>
      </div>
      <ScrollArea className="flex-grow">
        {sortedSessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <MessageSquareText className="mx-auto h-12 w-12 mb-2" />
            <p>No chat history yet.</p>
            <p className="text-xs">Start a new chat to see it here.</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sortedSessions.map((session) => {
              const isLive = session.id === activeLiveSessionId;
              const isSelected = session.id === currentSessionId;
              return (
                <Button
                  key={session.id}
                  variant={isSelected ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start h-auto py-2 px-3 text-left relative",
                    isSelected && "bg-primary/20 hover:bg-primary/30",
                    isLive && "border-l-2 border-accent"
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="flex flex-col overflow-hidden flex-grow">
                    <span className="text-xs font-medium text-foreground truncate block pr-5" title={session.title}>
                      {session.title || "Untitled Chat"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center mt-1">
                      <CalendarDays className="h-3 w-3 mr-1.5 flex-shrink-0" />
                      {format(new Date(session.startTime), 'yyyy-MM-dd HH:mm')}
                    </span>
                  </div>
                  {isLive && (
                    <Zap className="h-3.5 w-3.5 text-accent absolute right-2 top-1/2 -translate-y-1/2" title="Live Session" />
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
