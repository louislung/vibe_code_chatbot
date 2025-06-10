"use client";

import type { ChatSession } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { MessageSquareText, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export function HistoryPanel({ sessions, currentSessionId, onSelectSession }: HistoryPanelProps) {
  const sortedSessions = [...sessions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

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
            {sortedSessions.map((session) => (
              <Button
                key={session.id}
                variant={session.id === currentSessionId ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-auto py-2 px-3 text-left",
                  session.id === currentSessionId && "bg-primary/20 hover:bg-primary/30"
                )}
                onClick={() => onSelectSession(session.id)}
              >
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-medium text-foreground truncate block" title={session.title}>
                    {session.title || "Untitled Chat"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center mt-1">
                    <CalendarDays className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    {format(session.startTime, 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
