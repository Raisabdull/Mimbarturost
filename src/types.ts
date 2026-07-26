/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExpandedKeywords {
  indonesian: string[];
  arabic: string[];
}

export interface QurahVerse {
  text: string;
  translation: string;
  reference: string;
  keywords: string[];
  relevance: string;
  tafsir: string;
  tafsirRef: string;
}

export interface Hadith {
  text: string;
  translation: string;
  source: string;
  number?: string;
  status: string; // 'Shahih' | 'Hasan' | 'Dhaif' | 'Perlu Verifikasi'
  relevance: string;
  explanation: string;
}

export interface Atsar {
  figure: string;
  text: string;
  translation: string;
  source: string;
  relevance: string;
}

export interface Qaul {
  field: string; // 'Tafsir' | 'Hadis' | 'Tazkiyah/Adab' | 'Fikih/Ushul'
  book: string;
  author: string;
  text: string;
  translation: string;
  relevance: string;
}

export interface SermonMaterial {
  themeName: string;
  style: string;
  expandedKeywords: ExpandedKeywords;
  summary: string;
  points: string[];
  verses: QurahVerse[];
  hadiths: Hadith[];
  atsars: Atsar[];
  qauls: Qaul[];
  scientificCaution: string;
  draft: string;
}

export interface SermonHistoryItem {
  id: string;
  theme: string;
  style: string;
  timestamp: string;
  material: SermonMaterial;
}
