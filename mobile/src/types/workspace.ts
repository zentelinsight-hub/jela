export type WorkspaceEntitlements = {
  plan_code: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  meter_period: { start: string; end: string };
};

export type JelaProject = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  icon: string | null;
  cover_path: string | null;
  archived_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

export type JelaMemory = {
  id: string;
  scope: 'global' | 'project' | 'conversation';
  project_id: string | null;
  conversation_id: string | null;
  category: 'about_you' | 'preferences' | 'work_business' | 'learning' | 'project' | 'other';
  content: string;
  importance: number;
  pinned: boolean;
  source_type: 'manual' | 'conversation' | 'project' | 'imported';
  created_at: string;
  updated_at: string;
};

export type WorkspaceFile = {
  id: string;
  project_id: string | null;
  original_name: string;
  mime_type: 'text/plain' | 'application/pdf';
  size_bytes: number;
  status: 'uploading' | 'processing' | 'ready' | 'unable_to_process' | 'deleted';
  extraction_error: string | null;
  created_at: string;
  updated_at: string;
};

export type MemorySettings = {
  enabled: boolean;
  remember_useful: boolean;
  reference_conversations: boolean;
  project_memory: boolean;
  onboarded?: boolean;
};

export type WorkspaceSearchResults = {
  chats: { id: string; title: string; updated_at: string; project_id: string | null }[];
  projects: { id: string; name: string; description: string | null; updated_at: string }[];
  files: { id: string; original_name: string; status: string; project_id: string | null; updated_at: string }[];
  memories: { id: string; content: string; category: string; scope: string; project_id: string | null; updated_at: string }[];
  images: { id: string; prompt: string; conversation_id: string; project_id: string | null; created_at: string }[];
};

export type WorkspaceUsage = {
  entitlements: WorkspaceEntitlements;
  usage: {
    projects: number;
    memories: number;
    storageBytes: number;
    meters: { meter_key: string; used: number; reserved: number; period_start: string; period_end: string }[];
  };
};
