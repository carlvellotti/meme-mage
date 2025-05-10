export type MemeStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      meme_templates: {
        Row: {
          id: string;
          name: string;
          video_url: string;
          instructions: string | null;
          created_at: string;
          examples?: string[];
          tags?: string[];
        };
        Insert: {
          name: string;
          video_url: string;
          instructions?: string | null;
          examples?: string[];
          tags?: string[];
        };
        Update: {
          name?: string;
          video_url?: string;
          instructions?: string | null;
          examples?: string[];
          tags?: string[];
        };
      };
    };
  };
}

export interface MemeTemplate {
  id: string;
  name: string;
  video_url: string;
  instructions: string;
  embedding?: number[];
  poster_url?: string | null;
  created_at?: string;
  examples?: string[];
  tags?: string[];
  is_greenscreen?: boolean | null;
  original_source_url?: string | null;
  uploader_name?: string | null;
  feedback_status?: 'used' | 'dont_use' | null;
}

export interface MemeGeneration {
  id: string;
  template_id: string;
  caption: string;
  output_url: string | null;
  status: MemeStatus;
  created_at: string;
  updated_at: string;
} 