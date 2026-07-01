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
      byo_gateways: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          is_active: boolean
          merchant_id: string
          mode: string
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          merchant_id: string
          mode?: string
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          merchant_id?: string
          mode?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      fraud_blocklist: {
        Row: {
          block_type: string
          created_at: string
          id: string
          merchant_id: string
          reason: string | null
          value: string
        }
        Insert: {
          block_type: string
          created_at?: string
          id?: string
          merchant_id: string
          reason?: string | null
          value: string
        }
        Update: {
          block_type?: string
          created_at?: string
          id?: string
          merchant_id?: string
          reason?: string | null
          value?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base_currency: string
          id: string
          quote_currency: string
          rate: number
          updated_at: string
        }
        Insert: {
          base_currency: string
          id?: string
          quote_currency: string
          rate: number
          updated_at?: string
        }
        Update: {
          base_currency?: string
          id?: string
          quote_currency?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          id: string
          key: string
          merchant_id: string
          method: string
          path: string
          request_hash: string
          response_body: Json
          status_code: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          merchant_id: string
          method: string
          path: string
          request_hash: string
          response_body: Json
          status_code: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          merchant_id?: string
          method?: string
          path?: string
          request_hash?: string
          response_body?: Json
          status_code?: number
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
          mode: string
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
          mode?: string
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
          mode?: string
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
            referencedRelation: "checkout_methods"
            referencedColumns: ["id"]
          },
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
      notification_log: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          error: string | null
          event: string
          id: string
          merchant_id: string
          provider: string | null
          provider_response: Json | null
          recipient: string
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          error?: string | null
          event: string
          id?: string
          merchant_id: string
          provider?: string | null
          provider_response?: Json | null
          recipient: string
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          merchant_id?: string
          provider?: string | null
          provider_response?: Json | null
          recipient?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          email_enabled: boolean
          events: Json
          id: string
          inapp_enabled: boolean
          merchant_id: string
          notify_email: string | null
          notify_phone: string | null
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          events?: Json
          id?: string
          inapp_enabled?: boolean
          merchant_id: string
          notify_email?: string | null
          notify_phone?: string | null
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          events?: Json
          id?: string
          inapp_enabled?: boolean
          merchant_id?: string
          notify_email?: string | null
          notify_phone?: string | null
          sms_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event: string
          id: string
          merchant_id: string
          metadata: Json
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event: string
          id?: string
          merchant_id: string
          metadata?: Json
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event?: string
          id?: string
          merchant_id?: string
          metadata?: Json
          read_at?: string | null
          title?: string
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
      payouts: {
        Row: {
          account_name: string | null
          account_number: string
          admin_note: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          merchant_id: string
          method: string
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          admin_note?: string | null
          amount: number
          created_at?: string
          currency?: string
          id?: string
          merchant_id: string
          method: string
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          merchant_id?: string
          method?: string
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
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
          brand_color: string | null
          business_name: string | null
          checkout_footer: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          logo_url: string | null
          mfa_enabled: boolean
          phone: string | null
          status: string
          support_email: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          brand_color?: string | null
          business_name?: string | null
          checkout_footer?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          logo_url?: string | null
          mfa_enabled?: boolean
          phone?: string | null
          status?: string
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          brand_color?: string | null
          business_name?: string | null
          checkout_footer?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          logo_url?: string | null
          mfa_enabled?: boolean
          phone?: string | null
          status?: string
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          count: number
          key_id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key_id: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          key_id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_buckets_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: true
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          member_email: string
          member_id: string | null
          member_user_id: string | null
          merchant_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          member_email: string
          member_id?: string | null
          member_user_id?: string | null
          merchant_id: string
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          member_email?: string
          member_id?: string | null
          member_user_id?: string | null
          merchant_id?: string
          role?: string
          status?: string
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
          mode: string
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
          mode?: string
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
          mode?: string
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
            referencedRelation: "checkout_invoices"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "checkout_invoices"
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
          mode: string
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
          mode?: string
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
          mode?: string
          signing_secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      checkout_brand: {
        Row: {
          brand_color: string | null
          business_name: string | null
          checkout_footer: string | null
          logo_url: string | null
          merchant_id: string | null
          support_email: string | null
        }
        Insert: {
          brand_color?: string | null
          business_name?: string | null
          checkout_footer?: string | null
          logo_url?: string | null
          merchant_id?: string | null
          support_email?: string | null
        }
        Update: {
          brand_color?: string | null
          business_name?: string | null
          checkout_footer?: string | null
          logo_url?: string | null
          merchant_id?: string | null
          support_email?: string | null
        }
        Relationships: []
      }
      checkout_invoices: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          expires_at: string | null
          id: string | null
          invoice_number: string | null
          merchant_id: string | null
          metadata: Json | null
          method_id: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"] | null
          mode: string | null
          paid_at: string | null
          redirect_url: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string | null
          invoice_number?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          method_id?: string | null
          method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          mode?: string | null
          paid_at?: string | null
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string | null
          invoice_number?: string | null
          merchant_id?: string | null
          metadata?: Json | null
          method_id?: string | null
          method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          mode?: string | null
          paid_at?: string | null
          redirect_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "checkout_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          fee_flat: number | null
          fee_percent: number | null
          id: string | null
          instructions: string | null
          is_active: boolean | null
          label: string | null
          logo_url: string | null
          max_amount: number | null
          merchant_id: string | null
          min_amount: number | null
          mode: Database["public"]["Enums"]["payment_method_mode"] | null
          sort_order: number | null
          type: Database["public"]["Enums"]["payment_method_type"] | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          fee_flat?: number | null
          fee_percent?: number | null
          id?: string | null
          instructions?: string | null
          is_active?: boolean | null
          label?: string | null
          logo_url?: string | null
          max_amount?: number | null
          merchant_id?: string | null
          min_amount?: number | null
          mode?: Database["public"]["Enums"]["payment_method_mode"] | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["payment_method_type"] | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          fee_flat?: number | null
          fee_percent?: number | null
          id?: string | null
          instructions?: string | null
          is_active?: boolean | null
          label?: string | null
          logo_url?: string | null
          max_amount?: number | null
          merchant_id?: string | null
          min_amount?: number | null
          mode?: Database["public"]["Enums"]["payment_method_mode"] | null
          sort_order?: number | null
          type?: Database["public"]["Enums"]["payment_method_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_fraud_block: {
        Args: {
          _email: string
          _ip: string
          _merchant_id: string
          _phone: string
        }
        Returns: boolean
      }
      consume_rate_limit: {
        Args: { _key_id: string; _limit: number; _window_seconds: number }
        Returns: number
      }
      effective_merchant_role: {
        Args: { _merchant_id: string; _user_id: string }
        Returns: string
      }
      get_checkout_brand: {
        Args: { _merchant_id: string }
        Returns: {
          brand_color: string
          business_name: string
          checkout_footer: string
          logo_url: string
          merchant_id: string
          support_email: string
        }[]
      }
      get_checkout_invoice: {
        Args: { _id: string }
        Returns: {
          amount: number
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          description: string
          expires_at: string
          id: string
          invoice_number: string
          merchant_id: string
          metadata: Json
          method_id: string
          method_type: string
          mode: string
          paid_at: string
          redirect_url: string
          status: Database["public"]["Enums"]["invoice_status"]
        }[]
      }
      get_checkout_methods: {
        Args: { _merchant_id: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_methods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_checkout_transactions: {
        Args: { _invoice_id: string }
        Returns: {
          created_at: string
          gross_amount: number
          id: string
          method_type: string
          note: string
          provider_txn_id: string
          reference: string
          status: Database["public"]["Enums"]["transaction_status"]
          verified_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merchant_can: {
        Args: { _merchant_id: string; _min_role: string; _user_id: string }
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
