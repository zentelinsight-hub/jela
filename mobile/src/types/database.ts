export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'deactivated';
export type AppRole = 'user' | 'admin';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'failed';

export type JelaAccount = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  owner_id: string;
  title: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  owner_id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  request_id: string | null;
  error_code: string | null;
  created_at: string;
};

export type CreditWallet = {
  user_id: string;
  balance: number;
  reserved: number;
  lifetime_granted: number;
  lifetime_used: number;
  updated_at: string;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  price_minor: number;
  interval: 'month' | 'year' | 'one_time';
  features: string[];
  most_popular: boolean;
  sort_order: number;
  purchasable: boolean;
};

export type UsageState = {
  plan_code: string;
  plan_name: string;
  price_minor: number;
  currency: string;
  billing_interval: string;
  usage_available: boolean;
  can_send: boolean;
  next_free_reset_at: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  allowed_modes: ('auto' | 'deep_think' | 'research')[];
  features: Record<string, boolean>;
};

export type Subscription = {
  id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  jela_plans?: Pick<Plan, 'name' | 'code'> | null;
};

export type AppRelease = {
  id: string;
  platform: 'android' | 'ios' | 'web';
  version_name: string;
  version_code: number | null;
  minimum_supported_version: string | null;
  storage_path: string | null;
  download_url: string;
  release_notes: string | null;
  force_update: boolean;
  is_current: boolean;
  published_at: string;
};

export type FeatureFlags = {
  chat_enabled: boolean;
  attachments_enabled: boolean;
  voice_enabled: boolean;
  push_notifications_enabled: boolean;
  maintenance_mode: boolean;
};

export type AdminOverview = {
  accounts: number;
  conversations: number;
  messages: number;
  activeSubscriptions: number;
  failedRequests: number;
};
