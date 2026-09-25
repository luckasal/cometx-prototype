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
      articles: {
        Row: {
          body: string | null
          created_at: string
          excerpt: string | null
          hero_image_url: string | null
          id: string
          published_at: string | null
          required_entitlement: string | null
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["article_visibility"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          published_at?: string | null
          required_entitlement?: string | null
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["article_visibility"]
        }
        Update: {
          body?: string | null
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          published_at?: string | null
          required_entitlement?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["article_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "articles_required_entitlement_fkey"
            columns: ["required_entitlement"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["key"]
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      event_partners: {
        Row: {
          event_id: string
          partner_id: string
        }
        Insert: {
          event_id: string
          partner_id: string
        }
        Update: {
          event_id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_partners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      event_speakers: {
        Row: {
          event_id: string
          sort_order: number
          speaker_id: string
        }
        Insert: {
          event_id: string
          sort_order?: number
          speaker_id: string
        }
        Update: {
          event_id?: string
          sort_order?: number
          speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_speakers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_speakers_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          capacity: number | null
          created_at: string
          description: string | null
          end_date: string | null
          event_type: string
          event_status: Database["public"]["Enums"]["event_operational_status"]
          featured: boolean
          gallery_urls: Json
          hero_image_url: string | null
          id: string
          registration_end: string | null
          registration_start: string | null
          publish_state: Database["public"]["Enums"]["event_publish_state"]
          short_description: string | null
          slug: string
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          event_status?: Database["public"]["Enums"]["event_operational_status"]
          featured?: boolean
          gallery_urls?: Json
          hero_image_url?: string | null
          id?: string
          registration_end?: string | null
          registration_start?: string | null
          publish_state?: Database["public"]["Enums"]["event_publish_state"]
          short_description?: string | null
          slug: string
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          event_status?: Database["public"]["Enums"]["event_operational_status"]
          featured?: boolean
          gallery_urls?: Json
          hero_image_url?: string | null
          id?: string
          registration_end?: string | null
          registration_start?: string | null
          publish_state?: Database["public"]["Enums"]["event_publish_state"]
          short_description?: string | null
          slug?: string
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: { id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null; company: string | null; source: string; consent_at: string | null; newsletter_status: Database["public"]["Enums"]["contact_status"]; member_id: string | null; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; email: string; first_name?: string | null; last_name?: string | null; phone?: string | null; company?: string | null; source?: string; consent_at?: string | null; newsletter_status?: Database["public"]["Enums"]["contact_status"]; member_id?: string | null; notes?: string | null; created_at?: string; updated_at?: string }
        Update: { email?: string; first_name?: string | null; last_name?: string | null; phone?: string | null; company?: string | null; source?: string; consent_at?: string | null; newsletter_status?: Database["public"]["Enums"]["contact_status"]; member_id?: string | null; notes?: string | null; updated_at?: string }
        Relationships: []
      }
      content_entries: {
        Row: { id: string; content_type: Database["public"]["Enums"]["content_type"]; title: string; slug: string; summary: string | null; body: string | null; hero_image_url: string | null; media_urls: Json; status: Database["public"]["Enums"]["article_status"]; published_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; content_type: Database["public"]["Enums"]["content_type"]; title: string; slug: string; summary?: string | null; body?: string | null; hero_image_url?: string | null; media_urls?: Json; status?: Database["public"]["Enums"]["article_status"]; published_at?: string | null; created_at?: string; updated_at?: string }
        Update: { content_type?: Database["public"]["Enums"]["content_type"]; title?: string; slug?: string; summary?: string | null; body?: string | null; hero_image_url?: string | null; media_urls?: Json; status?: Database["public"]["Enums"]["article_status"]; published_at?: string | null; updated_at?: string }
        Relationships: []
      }
      payments: {
        Row: { id: string; user_id: string | null; registration_id: string | null; membership_id: string | null; stripe_customer_id: string | null; stripe_checkout_session_id: string | null; stripe_payment_intent_id: string | null; amount: number; currency: string; status: Database["public"]["Enums"]["payment_status"]; invoice_url: string | null; receipt_url: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id?: string | null; registration_id?: string | null; membership_id?: string | null; stripe_customer_id?: string | null; stripe_checkout_session_id?: string | null; stripe_payment_intent_id?: string | null; amount?: number; currency?: string; status?: Database["public"]["Enums"]["payment_status"]; invoice_url?: string | null; receipt_url?: string | null; created_at?: string; updated_at?: string }
        Update: { user_id?: string | null; registration_id?: string | null; membership_id?: string | null; stripe_customer_id?: string | null; stripe_checkout_session_id?: string | null; stripe_payment_intent_id?: string | null; amount?: number; currency?: string; status?: Database["public"]["Enums"]["payment_status"]; invoice_url?: string | null; receipt_url?: string | null; updated_at?: string }
        Relationships: []
      }
      membership_plans: {
        Row: {
          active: boolean
          annual_price: number
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          stripe_price_id: string | null
        }
        Insert: {
          active?: boolean
          annual_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
        }
        Update: {
          active?: boolean
          annual_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          membership_plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          membership_plan_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          membership_plan_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          tier: string | null
          website_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          tier?: string | null
          website_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          tier?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          entitlement_id: string
          id: string
          membership_plan_id: string
          value: number | null
        }
        Insert: {
          entitlement_id: string
          id?: string
          membership_plan_id: string
          value?: number | null
        }
        Update: {
          entitlement_id?: string
          id?: string
          membership_plan_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entitlements_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          created_at: string
          currency: string
          event_id: string
          id: string
          price_paid: number
          status: Database["public"]["Enums"]["registration_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          ticket_type_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          price_paid?: number
          status?: Database["public"]["Enums"]["registration_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          ticket_type_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          price_paid?: number
          status?: Database["public"]["Enums"]["registration_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          ticket_type_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      speakers: {
        Row: {
          bio: string | null
          company: string | null
          created_at: string
          id: string
          job_title: string | null
          linkedin_url: string | null
          name: string
          photo_url: string | null
          slug: string
          website_url: string | null
        }
        Insert: {
          bio?: string | null
          company?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          name: string
          photo_url?: string | null
          slug: string
          website_url?: string | null
        }
        Update: {
          bio?: string | null
          company?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          linkedin_url?: string | null
          name?: string
          photo_url?: string | null
          slug?: string
          website_url?: string | null
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          member_price: number | null
          sale_start: string | null
          sale_end: string | null
          active: boolean
          base_price: number
          capacity: number | null
          created_at: string
          currency: string
          description: string | null
          discount_entitlement: string | null
          event_id: string
          free_entitlement: string | null
          id: string
          name: string
          required_entitlement: string | null
          sort_order: number
        }
        Insert: {
          member_price?: number | null
          sale_start?: string | null
          sale_end?: string | null
          active?: boolean
          base_price?: number
          capacity?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          discount_entitlement?: string | null
          event_id: string
          free_entitlement?: string | null
          id?: string
          name: string
          required_entitlement?: string | null
          sort_order?: number
        }
        Update: {
          member_price?: number | null
          sale_start?: string | null
          sale_end?: string | null
          active?: boolean
          base_price?: number
          capacity?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          discount_entitlement?: string | null
          event_id?: string
          free_entitlement?: string | null
          id?: string
          name?: string
          required_entitlement?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_discount_entitlement_fkey"
            columns: ["discount_entitlement"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_types_free_entitlement_fkey"
            columns: ["free_entitlement"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "ticket_types_required_entitlement_fkey"
            columns: ["required_entitlement"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["key"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workshops: {
        Row: {
          base_price: number
          capacity: number | null
          created_at: string
          description: string | null
          end_time: string | null
          event_id: string
          id: string
          location: string | null
          separate_registration_required: boolean
          speaker_id: string | null
          start_time: string | null
          title: string
        }
        Insert: {
          base_price?: number
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_id: string
          id?: string
          location?: string | null
          separate_registration_required?: boolean
          speaker_id?: string | null
          start_time?: string | null
          title: string
        }
        Update: {
          base_price?: number
          capacity?: number | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_id?: string
          id?: string
          location?: string | null
          separate_registration_required?: boolean
          speaker_id?: string | null
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshops_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "speakers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      subscribe_newsletter: { Args: { p_email: string; p_first_name?: string | null; p_last_name?: string | null }; Returns: string }
      register_prototype_ticket: { Args: { p_ticket_type_id: string }; Returns: string };
      select_prototype_membership: { Args: { p_plan_slug: string }; Returns: string };
      reserve_free_ticket: { Args: { p_ticket_type_id: string }; Returns: string }
      fulfill_cometx_checkout: { Args: { p_session: Json }; Returns: undefined }
      begin_ticket_checkout: { Args: { p_user_id: string; p_ticket_id: string; p_quantity:number; p_payments_ready?: boolean }; Returns: Json }
      release_unstarted_ticket_checkout: { Args: { p_checkout_id: string }; Returns: undefined }
      apply_ticket_checkout_event: { Args: { p_type: string; p_session: Json }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "admin"
      article_status: "draft" | "published"
      article_visibility: "public" | "registered" | "members" | "entitlement"
      contact_status: "subscribed" | "unsubscribed" | "pending"
      content_type: "video" | "gallery" | "opinion" | "open_position" | "symposium"
      event_status:
        | "draft"
        | "published"
        | "registration_open"
        | "sold_out"
        | "completed"
        | "cancelled"
      event_operational_status: "upcoming" | "registration_open" | "registration_closed" | "sold_out" | "completed" | "cancelled"
      event_publish_state: "draft" | "published" | "unpublished"
      membership_status: "active" | "inactive" | "cancelled" | "past_due"
      payment_status: "pending" | "paid" | "failed" | "refunded" | "void"
      registration_status: "pending" | "confirmed" | "cancelled" | "checked_in"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin"],
      article_status: ["draft", "published"],
      article_visibility: ["public", "registered", "members", "entitlement"],
      contact_status: ["subscribed", "unsubscribed", "pending"],
      content_type: ["video", "gallery", "opinion", "open_position", "symposium"],
      event_status: [
        "draft",
        "published",
        "registration_open",
        "sold_out",
        "completed",
        "cancelled",
      ],
      event_operational_status: ["upcoming", "registration_open", "registration_closed", "sold_out", "completed", "cancelled"],
      event_publish_state: ["draft", "published", "unpublished"],
      membership_status: ["active", "inactive", "cancelled", "past_due"],
      payment_status: ["pending", "paid", "failed", "refunded", "void"],
      registration_status: ["pending", "confirmed", "cancelled", "checked_in"],
    },
  },
} as const
