import { MemeTemplate } from '../supabase/types';

export interface MemeVideo {
  id: string;
  name: string;
  videoUrl: string;
  instructions: string;
  typicalUsage: string;
  examples: string[];
  tags: string[];
}

export interface MemeRequest {
  concept: string;
  audience: string;
}

export interface MemeResponse {
  caption: string;
  videoId: string;
}

export interface BackgroundImage {
  id: string;
  name: string;
  url: string;
  attribution?: {
    photographerName: string;
    photographerUrl: string;
    photoUrl: string;
    username: string;
    instagram_username: string | null;
  };
}

export interface TextSettings {
  size: number;
  font: string;
  verticalPosition: number;
  alignment: 'left' | 'center' | 'right';
  color: 'white' | 'black';
  strokeWeight: number;
  backgroundColor?: 'black' | 'white' | 'none';
  backgroundOpacity?: number;
}

export interface SelectedMeme {
  templates: {
    template: MemeTemplate;
    captions: string[];
  }[];
} 