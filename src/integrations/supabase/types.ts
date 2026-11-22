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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      commercial_alerts: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          message: string
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          message: string
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      commercial_events: {
        Row: {
          attempts: number
          created_at: string
          created_by: string
          delivered: boolean
          delivered_at: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by: string
          delivered?: boolean
          delivered_at?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string
          delivered?: boolean
          delivered_at?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          status?: string
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_interactions: {
        Row: {
          content: string
          created_at: string
          customer_id: string | null
          id: string
          kind: string
          lead_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_next_actions: {
        Row: {
          assigned_to: string
          completed_at: string | null
          created_at: string
          created_by: string
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_next_actions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_owner_history: {
        Row: {
          changed_by: string
          created_at: string
          customer_id: string
          id: string
          new_owner_id: string | null
          note: string | null
          previous_owner_id: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          customer_id: string
          id?: string
          new_owner_id?: string | null
          note?: string | null
          previous_owner_id?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          customer_id?: string
          id?: string
          new_owner_id?: string | null
          note?: string | null
          previous_owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_owner_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          company_size: string | null
          created_at: string
          customer_code: string
          document: string | null
          email: string | null
          id: string
          last_activity_at: string | null
          lead_id: string | null
          legal_name: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          segment: string | null
          seller_id: string
          state: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          customer_code?: string
          document?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          legal_name?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          segment?: string | null
          seller_id: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          customer_code?: string
          document?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          segment?: string | null
          seller_id?: string
          state?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_policies: {
        Row: {
          id: string
          max_discount_percent: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          id?: string
          max_discount_percent?: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          id?: string
          max_discount_percent?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      export_jobs: {
        Row: {
          created_at: string
          dataset: string
          file_name: string
          format: string
          id: string
          row_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dataset: string
          file_name: string
          format: string
          id?: string
          row_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          dataset?: string
          file_name?: string
          format?: string
          id?: string
          row_count?: number
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          created_by: string
          id: string
          period_end: string
          period_start: string
          target_amount: number
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          period_end: string
          period_start: string
          target_amount?: number
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          period_end?: string
          period_start?: string
          target_amount?: number
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          provider: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          provider: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lead_stage_history: {
        Row: {
          changed_by: string
          created_at: string
          from_stage: Database["public"]["Enums"]["lead_stage"] | null
          id: string
          lead_id: string
          note: string | null
          to_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Insert: {
          changed_by: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id: string
          note?: string | null
          to_stage: Database["public"]["Enums"]["lead_stage"]
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["lead_stage"] | null
          id?: string
          lead_id?: string
          note?: string | null
          to_stage?: Database["public"]["Enums"]["lead_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          city: string | null
          cnpj: string | null
          company: string | null
          converted_at: string | null
          converted_by: string | null
          converted_customer_id: string | null
          created_at: string
          email: string | null
          estimated_value: number
          expected_close_date: string | null
          id: string
          last_activity_at: string | null
          lead_code: string
          loss_detail: string | null
          loss_reason: string | null
          name: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          postal_code: string | null
          probability: number
          segment: string | null
          source: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          state: string | null
          ultima_interacao: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          company?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lead_code?: string
          loss_detail?: string | null
          loss_reason?: string | null
          name: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          owner_id: string
          phone?: string | null
          postal_code?: string | null
          probability?: number
          segment?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          state?: string | null
          ultima_interacao?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          company?: string | null
          converted_at?: string | null
          converted_by?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          estimated_value?: number
          expected_close_date?: string | null
          id?: string
          last_activity_at?: string | null
          lead_code?: string
          loss_detail?: string | null
          loss_reason?: string | null
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          postal_code?: string | null
          probability?: number
          segment?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          state?: string | null
          ultima_interacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          expected_close_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          opportunity_code: string
          owner_id: string
          probability: number
          product_description: string | null
          product_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_code?: string
          owner_id: string
          probability?: number
          product_description?: string | null
          product_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_code?: string
          owner_id?: string
          probability?: number
          product_description?: string | null
          product_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_documents: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          position: number
          product_id: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_price: number
          old_price: number
          product_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_price: number
          old_price: number
          product_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          applications: string | null
          benefits: string | null
          category: string | null
          code: string | null
          color: string | null
          commercial_description: string | null
          cost: number
          created_at: string
          description: string | null
          dimensions: string | null
          id: string
          margin_percent: number
          model_number: number | null
          name: string
          pattern: string | null
          price: number
          purpose: string | null
          size: string | null
          sku: string | null
          specifications: Json
          stock: number
          style: string | null
          supplier: string | null
          technical_description: string | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          active?: boolean
          applications?: string | null
          benefits?: string | null
          category?: string | null
          code?: string | null
          color?: string | null
          commercial_description?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          margin_percent?: number
          model_number?: number | null
          name: string
          pattern?: string | null
          price: number
          purpose?: string | null
          size?: string | null
          sku?: string | null
          specifications?: Json
          stock?: number
          style?: string | null
          supplier?: string | null
          technical_description?: string | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          active?: boolean
          applications?: string | null
          benefits?: string | null
          category?: string | null
          code?: string | null
          color?: string | null
          commercial_description?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          margin_percent?: number
          model_number?: number | null
          name?: string
          pattern?: string | null
          price?: number
          purpose?: string | null
          size?: string | null
          sku?: string | null
          specifications?: Json
          stock?: number
          style?: string | null
          supplier?: string | null
          technical_description?: string | null
          updated_at?: string
          weight?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_approvals: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          discount_percent: number
          id: string
          note: string | null
          quote_id: string
          requested_by: string
          required_role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          discount_percent: number
          id?: string
          note?: string | null
          quote_id: string
          requested_by: string
          required_role: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          discount_percent?: number
          id?: string
          note?: string | null
          quote_id?: string
          requested_by?: string
          required_role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_approvals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          discount_percent: number
          id: string
          product_id: string
          quantity: number
          quote_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          id?: string
          product_id: string
          quantity: number
          quote_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_percent?: number
          id?: string
          product_id?: string
          quantity?: number
          quote_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_sends: {
        Row: {
          created_at: string
          id: string
          message: string | null
          pdf_path: string | null
          quote_id: string
          sent_by: string
          status: string
          subject: string | null
          to_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          pdf_path?: string | null
          quote_id: string
          sent_by: string
          status?: string
          subject?: string | null
          to_email: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          pdf_path?: string | null
          quote_id?: string
          sent_by?: string
          status?: string
          subject?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_sends_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          commercial_terms: string | null
          created_at: string
          customer_id: string
          discount_percent: number
          id: string
          notes: string | null
          number: number
          order_id: string | null
          seller_id: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          commercial_terms?: string | null
          created_at?: string
          customer_id: string
          discount_percent?: number
          id?: string
          notes?: string | null
          number?: number
          order_id?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          commercial_terms?: string | null
          created_at?: string
          customer_id?: string
          discount_percent?: number
          id?: string
          notes?: string | null
          number?: number
          order_id?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          manager_id: string | null
          name: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      detect_inactive_customers: { Args: { _days?: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_leader: { Args: { _user_id: string }; Returns: boolean }
      role_has: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      supervises: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "supervisor" | "gerente"
      lead_stage:
        | "novo"
        | "contato_realizado"
        | "qualificado"
        | "reuniao"
        | "oportunidade"
        | "proposta_enviada"
        | "negociacao"
        | "ganho"
        | "perdido"
        | "convertido"
      order_status:
        | "pendente"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "criado"
        | "aguardando_aprovacao"
        | "aprovado"
        | "processamento"
        | "faturado"
        | "finalizado"
        | "novo"
        | "entregue"
      quote_status:
        | "rascunho"
        | "aguardando_aprovacao"
        | "aprovado"
        | "reprovado"
        | "convertido"
        | "enviado"
        | "recusado"
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
      app_role: ["admin", "vendedor", "supervisor", "gerente"],
      lead_stage: [
        "novo",
        "contato_realizado",
        "qualificado",
        "reuniao",
        "oportunidade",
        "proposta_enviada",
        "negociacao",
        "ganho",
        "perdido",
        "convertido",
      ],
      order_status: [
        "pendente",
        "em_andamento",
        "concluido",
        "cancelado",
        "criado",
        "aguardando_aprovacao",
        "aprovado",
        "processamento",
        "faturado",
        "finalizado",
        "novo",
        "entregue",
      ],
      quote_status: [
        "rascunho",
        "aguardando_aprovacao",
        "aprovado",
        "reprovado",
        "convertido",
        "enviado",
        "recusado",
      ],
    },
  },
} as const
