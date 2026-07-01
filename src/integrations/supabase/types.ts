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
      api_keys: {
        Row: {
          created_at: string
          environment: string
          id: string
          is_active: boolean
          last_used_at: string | null
          merchant_id: string
          name: string
          public_key: string
          secret_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          merchant_id: string
          name: string
          public_key: string
          secret_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          merchant_id?: string
          name?: string
          public_key?: string
          secret_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          merchant_id: string | null
          metadata: Json
          resource: string | null
          resource_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          merchant_id?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          merchant_id?: string | null
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          expires_at: string | null
          fee_amount: number
          id: string
          invoice_number: string
          merchant_id: string
          metadata: Json
          method_id: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"] | null
          net_amount: number
          paid_at: string | null
          redirect_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          fee_amount?: number
          id?: string
          invoice_number: string
          merchant_id: string
          metadata?: Json
          method_id?: string | null
          method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          net_amount?: number
          paid_at?: string | null
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          fee_amount?: number
          id?: string
          invoice_number?: string
          merchant_id?: string
          metadata?: Json
          method_id?: string | null
          method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          net_amount?: number
          paid_at?: string | null
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_whitelist: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          label: string | null
          merchant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          label?: string | null
          merchant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          label?: string | null
          merchant_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          created_at: string
          credentials: Json
          fee_flat: number
          fee_percent: number
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          logo_url: string | null
          max_amount: number | null
          merchant_id: string
          min_amount: number | null
          mode: Database["public"]["Enums"]["payment_method_mode"]
          sort_order: number
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          credentials?: Json
          fee_flat?: number
          fee_percent?: number
          id?: string
          instructions?: string | null
          is_active?: boolean
          label: string
          logo_url?: string | null
          max_amount?: number | null
          merchant_id: string
          min_amount?: number | null
          mode?: Database["public"]["Enums"]["payment_method_mode"]
          sort_order?: number
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          created_at?: string
          credentials?: Json
          fee_flat?: number
          fee_percent?: number
          id?: string
          instructions?: string | null
          is_active?: boolean
          label?: string
          logo_url?: string | null
          max_amount?: number | null
          merchant_id?: string
          min_amount?: number | null
          mode?: Database["public"]["Enums"]["payment_method_mode"]
          sort_order?: number
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          allow_signup: boolean
          brand_name: string
          default_currency: string
          default_fee_flat: number
          default_fee_percent: number
          id: number
          logo_url: string | null
          settings: Json
          support_email: string | null
          updated_at: string
        }
        Insert: {
          allow_signup?: boolean
          brand_name?: string
          default_currency?: string
          default_fee_flat?: number
          default_fee_percent?: number
          id?: number
          logo_url?: string | null
          settings?: Json
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          allow_signup?: boolean
          brand_name?: string
          default_currency?: string
          default_fee_flat?: number
          default_fee_percent?: number
          id?: number
          logo_url?: string | null
          settings?: Json
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          fee_amount: number
          gross_amount: number
          id: string
          invoice_id: string
          merchant_id: string
          method_type: Database["public"]["Enums"]["payment_method_type"]
          net_amount: number
          note: string | null
          provider_txn_id: string | null
          raw_response: Json
          reference: string | null
          sender_name: string | null
          sender_number: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          fee_amount?: number
          gross_amount: number
          id?: string
          invoice_id: string
          merchant_id: string
          method_type: Database["public"]["Enums"]["payment_method_type"]
          net_amount?: number
          note?: string | null
          provider_txn_id?: string | null
          raw_response?: Json
          reference?: string | null
          sender_name?: string | null
          sender_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          invoice_id?: string
          merchant_id?: string
          method_type?: Database["public"]["Enums"]["payment_method_type"]
          net_amount?: number
          note?: string | null
          provider_txn_id?: string | null
          raw_response?: Json
          reference?: string | null
          sender_name?: string | null
          sender_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
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
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string | null
          event: string
          http_status: number | null
          id: string
          invoice_id: string | null
          merchant_id: string
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          status: Database["public"]["Enums"]["webhook_delivery_status"]
          updated_at: string
          url: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          event: string
          http_status?: number | null
          id?: string
          invoice_id?: string | null
          merchant_id: string
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          updated_at?: string
          url: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string | null
          event?: string
          http_status?: number | null
          id?: string
          invoice_id?: string | null
          merchant_id?: string
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          status?: Database["public"]["Enums"]["webhook_delivery_status"]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          merchant_id: string
          signing_secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          merchant_id: string
          signing_secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          merchant_id?: string
          signing_secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "merchant"
      invoice_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "expired"
        | "refunded"
        | "cancelled"
      payment_method_mode: "manual" | "api"
      payment_method_type:
        | "bkash"
        | "nagad"
        | "rocket"
        | "upay"
        | "tap"
        | "mcash"
        | "sure_cash"
        | "bank_transfer"
        | "card"
        | "crypto"
        | "other"
      transaction_status: "pending" | "verified" | "rejected"
      webhook_delivery_status: "pending" | "success" | "failed"
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
    Enums: {
      app_role: ["super_admin", "admin", "merchant"],
      invoice_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "expired",
        "refunded",
        "cancelled",
      ],
      payment_method_mode: ["manual", "api"],
      payment_method_type: [
        "bkash",
        "nagad",
        "rocket",
        "upay",
        "tap",
        "mcash",
        "sure_cash",
        "bank_transfer",
        "card",
        "crypto",
        "other",
      ],
      transaction_status: ["pending", "verified", "rejected"],
      webhook_delivery_status: ["pending", "success", "failed"],
    },
  },
} as const
