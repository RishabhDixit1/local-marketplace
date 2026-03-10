export type CommunityProfileRecord = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  bio?: string | null;
  location?: string | null;
  availability?: string | null;
  services?: string[] | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onboarding_completed?: boolean | null;
  profile_completion_percent?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CommunityServiceRecord = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  created_at?: string | null;
};

export type CommunityProductRecord = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  created_at?: string | null;
};

export type CommunityPostRecord = {
  id: string;
  text?: string | null;
  content?: string | null;
  description?: string | null;
  title?: string | null;
  user_id?: string | null;
  author_id?: string | null;
  created_by?: string | null;
  requester_id?: string | null;
  owner_id?: string | null;
  provider_id?: string | null;
  type?: string | null;
  post_type?: string | null;
  category?: string | null;
  status?: string | null;
  state?: string | null;
  visibility?: string | null;
  created_at?: string | null;
};

export type CommunityHelpRequestRecord = {
  id: string;
  requester_id?: string | null;
  title?: string | null;
  details?: string | null;
  category?: string | null;
  urgency?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  location_label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  created_at?: string | null;
};

export type CommunityReviewRecord = {
  provider_id: string;
  rating: number | null;
};

export type CommunityPresenceRecord = {
  provider_id: string;
  is_online: boolean | null;
  availability: string | null;
  response_sla_minutes: number | null;
  rolling_response_minutes: number | null;
  last_seen: string | null;
};

export type CommunityOrderStatsRecord = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

export type CommunityApiError = {
  ok: false;
  code: "UNAUTHORIZED" | "CONFIG" | "DB" | "FORBIDDEN" | "INVALID_PAYLOAD" | "NOT_FOUND";
  message: string;
};

export type CommunityFeedResponse =
  | {
      ok: true;
      currentUserId: string;
      currentUserProfile: CommunityProfileRecord | null;
      services: CommunityServiceRecord[];
      products: CommunityProductRecord[];
      posts: CommunityPostRecord[];
      helpRequests: CommunityHelpRequestRecord[];
      profiles: CommunityProfileRecord[];
      reviews: CommunityReviewRecord[];
      presence: CommunityPresenceRecord[];
    }
  | CommunityApiError;

export type CommunityPeopleResponse =
  | {
      ok: true;
      currentUserId: string;
      profiles: CommunityProfileRecord[];
      services: Pick<CommunityServiceRecord, "provider_id" | "category" | "price">[];
      products: Pick<CommunityProductRecord, "provider_id" | "category" | "price">[];
      posts: Pick<CommunityPostRecord, "user_id" | "author_id" | "created_by" | "provider_id" | "category" | "status" | "state">[];
      helpRequests: Pick<CommunityHelpRequestRecord, "requester_id" | "category" | "budget_min" | "budget_max" | "status">[];
      reviews: CommunityReviewRecord[];
      presence: CommunityPresenceRecord[];
      orderStats: CommunityOrderStatsRecord[];
    }
  | CommunityApiError;
