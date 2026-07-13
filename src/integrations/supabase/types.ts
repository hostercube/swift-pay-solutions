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
      admin_staff: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          last_login_at: string | null
          mfa_enabled: boolean
          mfa_enrolled_at: string | null
          permissions: string[]
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          mfa_enabled?: boolean
          mfa_enrolled_at?: string | null
          permissions?: string[]
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_login_at?: string | null
          mfa_enabled?: boolean
          mfa_enrolled_at?: string | null
          permissions?: string[]
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          latency_ms: number
          merchant_id: string
          method: string
          path: string
          status_code: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms: number
          merchant_id: string
          method: string
          path: string
          status_code: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          latency_ms?: number
          merchant_id?: string
          method?: string
          path?: string
          status_code?: number
          user_agent?: string | null
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
          label: string | null
          logo_url: string | null
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
          label?: string | null
          logo_url?: string | null
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
          label?: string | null
          logo_url?: string | null
          merchant_id?: string
          mode?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      digest_settings: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          last_sent_at: string | null
          merchant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          last_sent_at?: string | null
          merchant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          last_sent_at?: string | null
          merchant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          expires_at: string | null
          id: string
          max_uses: number | null
          merchant_id: string
          updated_at: string
          uses_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          merchant_id: string
          updated_at?: string
          uses_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          merchant_id?: string
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_note: string | null
          created_at: string
          evidence_url: string | null
          id: string
          invoice_id: string
          merchant_id: string
          merchant_note: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          invoice_id: string
          merchant_id: string
          merchant_note?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          evidence_url?: string | null
          id?: string
          invoice_id?: string
          merchant_id?: string
          merchant_note?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "checkout_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
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
      impersonation_events: {
        Row: {
          admin_email: string
          admin_user_id: string
          created_at: string
          id: string
          reason: string | null
          target_email: string
          target_user_id: string
        }
        Insert: {
          admin_email: string
          admin_user_id: string
          created_at?: string
          id?: string
          reason?: string | null
          target_email: string
          target_user_id: string
        }
        Update: {
          admin_email?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          target_email?: string
          target_user_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          body: string | null
          components: string[]
          created_at: string
          id: string
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          components?: string[]
          created_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          components?: string[]
          created_at?: string
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          allow_custom_amount: boolean
          amount: number
          auto_redirect: boolean
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          discount_amount: number
          discount_code: string | null
          display_currency: string | null
          expires_at: string | null
          fee_amount: number
          id: string
          invoice_number: string
          max_amount: number | null
          merchant_id: string
          metadata: Json
          method_id: string | null
          method_type: Database["public"]["Enums"]["payment_method_type"] | null
          min_amount: number | null
          mode: string
          net_amount: number
          paid_at: string | null
          redirect_url: string | null
          reusable: boolean
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          allow_custom_amount?: boolean
          amount: number
          auto_redirect?: boolean
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          discount_amount?: number
          discount_code?: string | null
          display_currency?: string | null
          expires_at?: string | null
          fee_amount?: number
          id?: string
          invoice_number: string
          max_amount?: number | null
          merchant_id: string
          metadata?: Json
          method_id?: string | null
          method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          min_amount?: number | null
          mode?: string
          net_amount?: number
          paid_at?: string | null
          redirect_url?: string | null
          reusable?: boolean
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          allow_custom_amount?: boolean
          amount?: number
          auto_redirect?: boolean
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          discount_amount?: number
          discount_code?: string | null
          display_currency?: string | null
          expires_at?: string | null
          fee_amount?: number
          id?: string
          invoice_number?: string
          max_amount?: number | null
          merchant_id?: string
          metadata?: Json
          method_id?: string | null
          method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          min_amount?: number | null
          mode?: string
          net_amount?: number
          paid_at?: string | null
          redirect_url?: string | null
          reusable?: boolean
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
      merchant_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          merchant_id: string
          updated_at: string
          use_for: string
          verified_at: string | null
          verify_token: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          merchant_id: string
          updated_at?: string
          use_for?: string
          verified_at?: string | null
          verify_token?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          merchant_id?: string
          updated_at?: string
          use_for?: string
          verified_at?: string | null
          verify_token?: string
        }
        Relationships: []
      }
      merchant_fx_rates: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          markup_percent: number
          merchant_id: string
          mode: string
          quote_currency: string
          rate: number
          updated_at: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          id?: string
          markup_percent?: number
          merchant_id: string
          mode?: string
          quote_currency: string
          rate: number
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          markup_percent?: number
          merchant_id?: string
          mode?: string
          quote_currency?: string
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_fx_rates_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "checkout_brand"
            referencedColumns: ["merchant_id"]
          },
          {
            foreignKeyName: "merchant_fx_rates_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_smsnoc_configs: {
        Row: {
          api_key: string | null
          channel_email: boolean
          channel_sms: boolean
          channel_voice: boolean
          channel_whatsapp: boolean
          created_at: string
          email_config_id: string | null
          enabled: boolean
          merchant_id: string
          notify_email: string | null
          notify_on_invoice_created: boolean
          notify_on_payment_received: boolean
          notify_on_refund: boolean
          notify_phone: string | null
          notify_whatsapp: string | null
          sender_id: string | null
          templates: Json
          updated_at: string
          whatsapp_device_id: string | null
        }
        Insert: {
          api_key?: string | null
          channel_email?: boolean
          channel_sms?: boolean
          channel_voice?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          email_config_id?: string | null
          enabled?: boolean
          merchant_id: string
          notify_email?: string | null
          notify_on_invoice_created?: boolean
          notify_on_payment_received?: boolean
          notify_on_refund?: boolean
          notify_phone?: string | null
          notify_whatsapp?: string | null
          sender_id?: string | null
          templates?: Json
          updated_at?: string
          whatsapp_device_id?: string | null
        }
        Update: {
          api_key?: string | null
          channel_email?: boolean
          channel_sms?: boolean
          channel_voice?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          email_config_id?: string | null
          enabled?: boolean
          merchant_id?: string
          notify_email?: string | null
          notify_on_invoice_created?: boolean
          notify_on_payment_received?: boolean
          notify_on_refund?: boolean
          notify_phone?: string | null
          notify_whatsapp?: string | null
          sender_id?: string | null
          templates?: Json
          updated_at?: string
          whatsapp_device_id?: string | null
        }
        Relationships: []
      }
      merchant_subscriptions: {
        Row: {
          auto_renew: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          last_renewed_at: string | null
          merchant_id: string
          metadata: Json
          package_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          last_renewed_at?: string | null
          merchant_id: string
          metadata?: Json
          package_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          last_renewed_at?: string | null
          merchant_id?: string
          metadata?: Json
          package_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          error: string | null
          event: string
          id: string
          merchant_id: string | null
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
          merchant_id?: string | null
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
          merchant_id?: string | null
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
          discord_webhook_url: string | null
          email_enabled: boolean
          events: Json
          id: string
          inapp_enabled: boolean
          merchant_id: string
          notify_email: string | null
          notify_phone: string | null
          slack_webhook_url: string | null
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          discord_webhook_url?: string | null
          email_enabled?: boolean
          events?: Json
          id?: string
          inapp_enabled?: boolean
          merchant_id: string
          notify_email?: string | null
          notify_phone?: string | null
          slack_webhook_url?: string | null
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          discord_webhook_url?: string | null
          email_enabled?: boolean
          events?: Json
          id?: string
          inapp_enabled?: boolean
          merchant_id?: string
          notify_email?: string | null
          notify_phone?: string | null
          slack_webhook_url?: string | null
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
          bank_name: string | null
          branch_name: string | null
          created_at: string
          credentials: Json
          fee_flat: number
          fee_percent: number
          gateway_provider: string | null
          gateway_source: string | null
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          logo_url: string | null
          max_amount: number | null
          merchant_id: string
          min_amount: number | null
          mode: Database["public"]["Enums"]["payment_method_mode"]
          qr_code_url: string | null
          qr_type: string | null
          routing_number: string | null
          sort_order: number
          swift_code: string | null
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string
          credentials?: Json
          fee_flat?: number
          fee_percent?: number
          gateway_provider?: string | null
          gateway_source?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          label: string
          logo_url?: string | null
          max_amount?: number | null
          merchant_id: string
          min_amount?: number | null
          mode?: Database["public"]["Enums"]["payment_method_mode"]
          qr_code_url?: string | null
          qr_type?: string | null
          routing_number?: string | null
          sort_order?: number
          swift_code?: string | null
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string
          credentials?: Json
          fee_flat?: number
          fee_percent?: number
          gateway_provider?: string | null
          gateway_source?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          label?: string
          logo_url?: string | null
          max_amount?: number | null
          merchant_id?: string
          min_amount?: number | null
          mode?: Database["public"]["Enums"]["payment_method_mode"]
          qr_code_url?: string | null
          qr_type?: string | null
          routing_number?: string | null
          sort_order?: number
          swift_code?: string | null
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Relationships: []
      }
      payout_schedules: {
        Row: {
          account_name: string | null
          account_number: string
          created_at: string
          enabled: boolean
          frequency: string
          id: string
          last_run_at: string | null
          merchant_id: string
          method: string
          min_amount: number
          next_run_at: string
          runs_count: number
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          created_at?: string
          enabled?: boolean
          frequency: string
          id?: string
          last_run_at?: string | null
          merchant_id: string
          method: string
          min_amount?: number
          next_run_at?: string
          runs_count?: number
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          merchant_id?: string
          method?: string
          min_amount?: number
          next_run_at?: string
          runs_count?: number
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
      platform_gateways: {
        Row: {
          commission_flat: number
          commission_percent: number
          created_at: string
          credentials: Json
          id: string
          is_active: boolean
          is_enabled_for_merchants: boolean
          mode: string
          notes: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          commission_flat?: number
          commission_percent?: number
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          is_enabled_for_merchants?: boolean
          mode?: string
          notes?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          commission_flat?: number
          commission_percent?: number
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          is_enabled_for_merchants?: boolean
          mode?: string
          notes?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_plugins: {
        Row: {
          created_at: string
          description: string | null
          docs_url: string | null
          download_url: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          platform: string
          repo_url: string | null
          slug: string
          sort_order: number
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          docs_url?: string | null
          download_url?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          platform: string
          repo_url?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          docs_url?: string | null
          download_url?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          platform?: string
          repo_url?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          version?: string | null
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
          verification_mode: string
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
          verification_mode?: string
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
          verification_mode?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accept_tips: boolean
          address: string | null
          avatar_url: string | null
          brand_color: string | null
          business_name: string | null
          checkout_footer: string | null
          checkout_style: string
          city: string | null
          country: string | null
          created_at: string
          custom_footer_html: string | null
          custom_head_html: string | null
          date_of_birth: string | null
          email: string
          full_name: string | null
          ga4_measurement_id: string | null
          google_ads_conversion_id: string | null
          google_ads_conversion_label: string | null
          gtm_container_id: string | null
          id: string
          kyc_address: string | null
          kyc_business_type: string | null
          kyc_documents: Json
          kyc_id_number: string | null
          kyc_id_type: string | null
          kyc_reviewed_at: string | null
          kyc_reviewer_note: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          language: string | null
          logo_url: string | null
          meta_capi_test_code: string | null
          meta_capi_token: string | null
          meta_pixel_id: string | null
          mfa_enabled: boolean
          mfa_enrolled_at: string | null
          phone: string | null
          postcode: string | null
          public_bio: string | null
          seo_meta_description: string | null
          seo_meta_keywords: string | null
          slug: string | null
          state: string | null
          status: string
          support_email: string | null
          tax_id: string | null
          tiktok_pixel_id: string | null
          timezone: string | null
          tip_min_amount: number
          updated_at: string
          website: string | null
        }
        Insert: {
          accept_tips?: boolean
          address?: string | null
          avatar_url?: string | null
          brand_color?: string | null
          business_name?: string | null
          checkout_footer?: string | null
          checkout_style?: string
          city?: string | null
          country?: string | null
          created_at?: string
          custom_footer_html?: string | null
          custom_head_html?: string | null
          date_of_birth?: string | null
          email: string
          full_name?: string | null
          ga4_measurement_id?: string | null
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          gtm_container_id?: string | null
          id: string
          kyc_address?: string | null
          kyc_business_type?: string | null
          kyc_documents?: Json
          kyc_id_number?: string | null
          kyc_id_type?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewer_note?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          language?: string | null
          logo_url?: string | null
          meta_capi_test_code?: string | null
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          mfa_enabled?: boolean
          mfa_enrolled_at?: string | null
          phone?: string | null
          postcode?: string | null
          public_bio?: string | null
          seo_meta_description?: string | null
          seo_meta_keywords?: string | null
          slug?: string | null
          state?: string | null
          status?: string
          support_email?: string | null
          tax_id?: string | null
          tiktok_pixel_id?: string | null
          timezone?: string | null
          tip_min_amount?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          accept_tips?: boolean
          address?: string | null
          avatar_url?: string | null
          brand_color?: string | null
          business_name?: string | null
          checkout_footer?: string | null
          checkout_style?: string
          city?: string | null
          country?: string | null
          created_at?: string
          custom_footer_html?: string | null
          custom_head_html?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string | null
          ga4_measurement_id?: string | null
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          gtm_container_id?: string | null
          id?: string
          kyc_address?: string | null
          kyc_business_type?: string | null
          kyc_documents?: Json
          kyc_id_number?: string | null
          kyc_id_type?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewer_note?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          language?: string | null
          logo_url?: string | null
          meta_capi_test_code?: string | null
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          mfa_enabled?: boolean
          mfa_enrolled_at?: string | null
          phone?: string | null
          postcode?: string | null
          public_bio?: string | null
          seo_meta_description?: string | null
          seo_meta_keywords?: string | null
          slug?: string | null
          state?: string | null
          status?: string
          support_email?: string | null
          tax_id?: string | null
          tiktok_pixel_id?: string | null
          timezone?: string | null
          tip_min_amount?: number
          updated_at?: string
          website?: string | null
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
      recurring_schedules: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          id: string
          interval_count: number
          interval_unit: string
          is_active: boolean
          last_run_at: string | null
          merchant_id: string
          mode: string
          name: string
          next_run_at: string
          redirect_url: string | null
          runs_count: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          interval_count?: number
          interval_unit: string
          is_active?: boolean
          last_run_at?: string | null
          merchant_id: string
          mode?: string
          name: string
          next_run_at: string
          redirect_url?: string | null
          runs_count?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          interval_count?: number
          interval_unit?: string
          is_active?: boolean
          last_run_at?: string | null
          merchant_id?: string
          mode?: string
          name?: string
          next_run_at?: string
          redirect_url?: string | null
          runs_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          admin_note: string | null
          amount: number
          api_key_id: string | null
          created_at: string
          currency: string
          id: string
          invoice_id: string
          merchant_id: string
          processed_at: string | null
          processed_by: string | null
          provider: string | null
          provider_refund_id: string | null
          provider_response: Json | null
          reason: string | null
          requested_via: string
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          api_key_id?: string | null
          created_at?: string
          currency: string
          id?: string
          invoice_id: string
          merchant_id: string
          processed_at?: string | null
          processed_by?: string | null
          provider?: string | null
          provider_refund_id?: string | null
          provider_response?: Json | null
          reason?: string | null
          requested_via?: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          api_key_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          merchant_id?: string
          processed_at?: string | null
          processed_by?: string | null
          provider?: string | null
          provider_refund_id?: string | null
          provider_response?: Json | null
          reason?: string | null
          requested_via?: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "checkout_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_event_logs: {
        Row: {
          amount: number | null
          created_at: string
          device_id: string | null
          id: string
          matched_invoice_id: string | null
          matched_layer: string
          matched_txn_id: string | null
          merchant_id: string
          outcome: string
          provider: string | null
          raw_body: string | null
          reason: string | null
          received_at: string | null
          sender: string | null
          trx_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          device_id?: string | null
          id?: string
          matched_invoice_id?: string | null
          matched_layer: string
          matched_txn_id?: string | null
          merchant_id: string
          outcome: string
          provider?: string | null
          raw_body?: string | null
          reason?: string | null
          received_at?: string | null
          sender?: string | null
          trx_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          device_id?: string | null
          id?: string
          matched_invoice_id?: string | null
          matched_layer?: string
          matched_txn_id?: string | null
          merchant_id?: string
          outcome?: string
          provider?: string | null
          raw_body?: string | null
          reason?: string | null
          received_at?: string | null
          sender?: string | null
          trx_id?: string | null
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          merchant_id: string
          meta: Json
          note: string | null
          package_id: string | null
          subscription_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          merchant_id: string
          meta?: Json
          note?: string | null
          package_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          merchant_id?: string
          meta?: Json
          note?: string | null
          package_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "merchant_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_packages: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_public: boolean
          limits: Json
          name: string
          permissions: string[]
          price: number
          slug: string
          sort_order: number
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          limits?: Json
          name: string
          permissions?: string[]
          price?: number
          slug: string
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          limits?: Json
          name?: string
          permissions?: string[]
          price?: number
          slug?: string
          sort_order?: number
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          accepted_at: string | null
          avatar_url: string | null
          department: string | null
          id: string
          invited_at: string
          last_login_at: string | null
          member_email: string
          member_id: string | null
          member_user_id: string | null
          merchant_id: string
          permissions: string[]
          phone: string | null
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          avatar_url?: string | null
          department?: string | null
          id?: string
          invited_at?: string
          last_login_at?: string | null
          member_email: string
          member_id?: string | null
          member_user_id?: string | null
          merchant_id: string
          permissions?: string[]
          phone?: string | null
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          avatar_url?: string | null
          department?: string | null
          id?: string
          invited_at?: string
          last_login_at?: string | null
          member_email?: string
          member_id?: string | null
          member_user_id?: string | null
          merchant_id?: string
          permissions?: string[]
          phone?: string | null
          role?: string
          status?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          bank_reference: string | null
          created_at: string
          drained_at: string | null
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
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          sender_name: string | null
          sender_number: string | null
          slip_url: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bank_reference?: string | null
          created_at?: string
          drained_at?: string | null
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
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          sender_name?: string | null
          sender_number?: string | null
          slip_url?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bank_reference?: string | null
          created_at?: string
          drained_at?: string | null
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
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          sender_name?: string | null
          sender_number?: string | null
          slip_url?: string | null
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
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          headers: Json
          id: string
          invoice_id: string | null
          merchant_id: string | null
          processed: boolean
          provider: string
          provider_event_id: string | null
          raw_body: string
          signature_verified: boolean
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          invoice_id?: string | null
          merchant_id?: string | null
          processed?: boolean
          provider: string
          provider_event_id?: string | null
          raw_body: string
          signature_verified?: boolean
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          invoice_id?: string | null
          merchant_id?: string | null
          processed?: boolean
          provider?: string
          provider_event_id?: string | null
          raw_body?: string
          signature_verified?: boolean
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "checkout_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
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
      admin_has_perm: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      apply_discount_code: {
        Args: { _code: string; _invoice_id: string }
        Returns: {
          discount: number
          message: string
          new_amount: number
          ok: boolean
        }[]
      }
      assign_subscription: {
        Args: {
          _auto_renew?: boolean
          _merchant_id: string
          _package_id: string
        }
        Returns: string
      }
      cancel_subscription: {
        Args: { _subscription_id: string }
        Returns: undefined
      }
      check_fraud_block: {
        Args: {
          _email: string
          _ip: string
          _merchant_id: string
          _phone: string
        }
        Returns: boolean
      }
      claim_first_super_admin: { Args: never; Returns: boolean }
      compute_period_end: {
        Args: {
          _cycle: Database["public"]["Enums"]["billing_cycle"]
          _start: string
        }
        Returns: string
      }
      consume_rate_limit: {
        Args: { _key_id: string; _limit: number; _window_seconds: number }
        Returns: number
      }
      effective_merchant_role: {
        Args: { _merchant_id: string; _user_id: string }
        Returns: string
      }
      expire_due_subscriptions: { Args: never; Returns: number }
      get_active_subscription: {
        Args: { _merchant_id: string }
        Returns: {
          auto_renew: boolean
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          currency: string
          current_period_end: string
          current_period_start: string
          features: Json
          id: string
          limits: Json
          package_id: string
          package_name: string
          package_slug: string
          permissions: string[]
          price: number
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string
        }[]
      }
      get_checkout_brand: {
        Args: { _merchant_id: string }
        Returns: {
          brand_color: string
          business_name: string
          checkout_footer: string
          checkout_style: string
          custom_footer_html: string
          custom_head_html: string
          ga4_measurement_id: string
          google_ads_conversion_id: string
          google_ads_conversion_label: string
          gtm_container_id: string
          logo_url: string
          merchant_id: string
          meta_pixel_id: string
          support_email: string
          tiktok_pixel_id: string
        }[]
      }
      get_checkout_gateways: {
        Args: { _merchant_id: string }
        Returns: {
          id: string
          label: string
          logo_url: string
          mode: string
          provider: string
        }[]
      }
      get_checkout_invoice: {
        Args: { _id: string }
        Returns: {
          allow_custom_amount: boolean
          amount: number
          auto_redirect: boolean
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          description: string
          expires_at: string
          id: string
          invoice_number: string
          max_amount: number
          merchant_id: string
          metadata: Json
          method_id: string
          method_type: string
          min_amount: number
          mode: string
          paid_at: string
          redirect_url: string
          reusable: boolean
          status: Database["public"]["Enums"]["invoice_status"]
        }[]
      }
      get_checkout_methods: {
        Args: { _merchant_id: string }
        Returns: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          branch_name: string | null
          created_at: string
          credentials: Json
          fee_flat: number
          fee_percent: number
          gateway_provider: string | null
          gateway_source: string | null
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          logo_url: string | null
          max_amount: number | null
          merchant_id: string
          min_amount: number | null
          mode: Database["public"]["Enums"]["payment_method_mode"]
          qr_code_url: string | null
          qr_type: string | null
          routing_number: string | null
          sort_order: number
          swift_code: string | null
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
      get_customer_invoices: {
        Args: { _email: string; _invoice_number: string }
        Returns: {
          amount: number
          business_name: string
          created_at: string
          currency: string
          description: string
          expires_at: string
          id: string
          invoice_number: string
          paid_at: string
          status: Database["public"]["Enums"]["invoice_status"]
        }[]
      }
      get_effective_fx_rate: {
        Args: { _base: string; _merchant_id: string; _quote: string }
        Returns: number
      }
      get_public_merchant: {
        Args: { _slug: string }
        Returns: {
          accept_tips: boolean
          brand_color: string
          business_name: string
          custom_footer_html: string
          custom_head_html: string
          ga4_measurement_id: string
          google_ads_conversion_id: string
          google_ads_conversion_label: string
          gtm_container_id: string
          id: string
          logo_url: string
          meta_pixel_id: string
          public_bio: string
          seo_meta_description: string
          seo_meta_keywords: string
          slug: string
          support_email: string
          tiktok_pixel_id: string
          tip_min_amount: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_office: { Args: { _user_id: string }; Returns: boolean }
      mark_domain_verified: { Args: { _domain_id: string }; Returns: undefined }
      merchant_can: {
        Args: { _merchant_id: string; _min_role: string; _user_id: string }
        Returns: boolean
      }
      merchant_has_package_permission: {
        Args: { _merchant_id: string; _perm: string }
        Returns: boolean
      }
      merchant_has_perm: {
        Args: { _merchant_id: string; _perm: string; _user_id: string }
        Returns: boolean
      }
      renew_due_subscriptions: { Args: never; Returns: number }
      resolve_merchant_domain: {
        Args: { _host: string }
        Returns: {
          business_name: string
          merchant_id: string
          slug: string
          use_for: string
        }[]
      }
      set_checkout_amount: {
        Args: { _amount: number; _invoice_id: string }
        Returns: {
          message: string
          new_amount: number
          ok: boolean
        }[]
      }
      sync_mfa_state: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "merchant"
      billing_cycle: "monthly" | "yearly" | "lifetime"
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
        | "bangla_qr"
      refund_status: "requested" | "approved" | "processed" | "rejected"
      subscription_status: "trialing" | "active" | "expired" | "cancelled"
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
      billing_cycle: ["monthly", "yearly", "lifetime"],
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
        "bangla_qr",
      ],
      refund_status: ["requested", "approved", "processed", "rejected"],
      subscription_status: ["trialing", "active", "expired", "cancelled"],
      transaction_status: ["pending", "verified", "rejected"],
      webhook_delivery_status: ["pending", "success", "failed"],
    },
  },
} as const
