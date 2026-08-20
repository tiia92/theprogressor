export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      article_reactions: {
        Row: {
          article_id: string
          created_at: string
          id: string
          user_id: string
          value: number
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          user_id: string
          value: number
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_reactions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          article_type: string
          body: string
          category: string
          created_at: string
          dek: string
          downvotes: number
          featured: boolean
          hero_gradient: string
          hero_image_url: string | null
          id: string
          published_at: string
          search_vector: unknown
          slug: string
          sources: Json
          tags: string[]
          title: string
          upvotes: number
          views: number
        }
        Insert: {
          article_type: string
          body: string
          category?: string
          created_at?: string
          dek: string
          downvotes?: number
          featured?: boolean
          hero_gradient?: string
          hero_image_url?: string | null
          id?: string
          published_at?: string
          search_vector?: unknown
          slug: string
          sources?: Json
          tags?: string[]
          title: string
          upvotes?: number
          views?: number
        }
        Update: {
          article_type?: string
          body?: string
          category?: string
          created_at?: string
          dek?: string
          downvotes?: number
          featured?: boolean
          hero_gradient?: string
          hero_image_url?: string | null
          id?: string
          published_at?: string
          search_vector?: unknown
          slug?: string
          sources?: Json
          tags?: string[]
          title?: string
          upvotes?: number
          views?: number
        }
        Relationships: []
      }
      crowdsource_pitches: {
        Row: {
          created_at: string
          id: string
          score: number
          source_outlet: string | null
          source_url: string | null
          status: string
          summary: string
          title: string
          topics: string[]
          transcript: Json
          user_id: string | null
          verdict: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          score?: number
          source_outlet?: string | null
          source_url?: string | null
          status?: string
          summary: string
          title: string
          topics?: string[]
          transcript?: Json
          user_id?: string | null
          verdict?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          score?: number
          source_outlet?: string | null
          source_url?: string | null
          status?: string
          summary?: string
          title?: string
          topics?: string[]
          transcript?: Json
          user_id?: string | null
          verdict?: string | null
        }
        Relationships: []
      }
      followed_keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          user_id?: string
        }
        Relationships: []
      }
      followed_topics: {
        Row: {
          created_at: string
          id: string
          topic_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          topic_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          topic_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          brevo_synced: boolean
          cadence: string
          created_at: string
          email: string
          id: string
          last_sent_at: string | null
          personalized: boolean
          status: string
          unsubscribe_token: string
          user_id: string | null
        }
        Insert: {
          brevo_synced?: boolean
          cadence?: string
          created_at?: string
          email: string
          id?: string
          last_sent_at?: string | null
          personalized?: boolean
          status?: string
          unsubscribe_token?: string
          user_id?: string | null
        }
        Update: {
          brevo_synced?: boolean
          cadence?: string
          created_at?: string
          email?: string
          id?: string
          last_sent_at?: string | null
          personalized?: boolean
          status?: string
          unsubscribe_token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      podcast_comments: {
        Row: {
          ai_reason: string | null
          ai_score: number
          author_name: string
          body: string
          created_at: string
          episode_slug: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          ai_reason?: string | null
          ai_score?: number
          author_name?: string
          body: string
          created_at?: string
          episode_slug: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          ai_reason?: string | null
          ai_score?: number
          author_name?: string
          body?: string
          created_at?: string
          episode_slug?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          audio_path: string | null
          chapters: Json
          created_at: string
          duration_seconds: number | null
          id: string
          published_at: string | null
          script: string
          slug: string
          status: string
          summary: string
          title: string
          week_start: string
        }
        Insert: {
          audio_path?: string | null
          chapters?: Json
          created_at?: string
          duration_seconds?: number | null
          id?: string
          published_at?: string | null
          script?: string
          slug: string
          status?: string
          summary?: string
          title: string
          week_start: string
        }
        Update: {
          audio_path?: string | null
          chapters?: Json
          created_at?: string
          duration_seconds?: number | null
          id?: string
          published_at?: string | null
          script?: string
          slug?: string
          status?: string
          summary?: string
          title?: string
          week_start?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      saved_articles: {
        Row: {
          article_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          active: boolean
          copy: string
          created_at: string
          ends_on: string | null
          id: string
          link: string | null
          name: string
          sort_order: number
          starts_on: string | null
        }
        Insert: {
          active?: boolean
          copy?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          link?: string | null
          name: string
          sort_order?: number
          starts_on?: string | null
        }
        Update: {
          active?: boolean
          copy?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          link?: string | null
          name?: string
          sort_order?: number
          starts_on?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
