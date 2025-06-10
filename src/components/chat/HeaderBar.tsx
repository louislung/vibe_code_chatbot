"use client";

import type React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelRightOpen, PanelRightClose, Languages, Globe } from "lucide-react";
import type { Region, Language } from "@/lib/types";
import LogoIcon from "@/components/icons/LogoIcon";

interface HeaderBarProps {
  showHistory: boolean;
  onToggleHistory: () => void;
  selectedRegion: Region | 'none';
  onRegionChange: (region: Region | 'none') => void;
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

const regions: Array<{ value: Region | 'none'; label: string }> = [
  { value: 'none', label: 'No Region' },
  { value: 'West', label: 'West' },
  { value: 'Ontario', label: 'Ontario' },
  { value: 'Atlantic', label: 'Atlantic' },
  { value: 'Quebec', label: 'Quebec' },
];

const languages: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

export function HeaderBar({
  showHistory,
  onToggleHistory,
  selectedRegion,
  onRegionChange,
  currentLanguage,
  onLanguageChange,
}: HeaderBarProps) {
  return (
    <header className="flex items-center justify-between p-3 border-b bg-card shadow-sm h-16">
      <div className="flex items-center gap-4">
        <LogoIcon />
      </div>
      <div className="flex items-center gap-3">
        <Select value={selectedRegion} onValueChange={(value) => onRegionChange(value as Region | 'none')}>
          <SelectTrigger className="w-[180px] text-sm">
            <Globe className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select Region" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.value} value={r.value} className="text-sm">
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currentLanguage} onValueChange={(value) => onLanguageChange(value as Language)}>
          <SelectTrigger className="w-[150px] text-sm">
            <Languages className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.value} value={lang.value} className="text-sm">
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={onToggleHistory} aria-label="Toggle chat history">
          {showHistory ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  );
}
