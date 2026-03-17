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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          is_maintenance_mode: boolean | null
          maintenance_message: string | null
        }
        Insert: {
          id?: number
          is_maintenance_mode?: boolean | null
          maintenance_message?: string | null
        }
        Update: {
          id?: number
          is_maintenance_mode?: boolean | null
          maintenance_message?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          display_order: number | null
          id: string
          image_url: string | null
          name_en: string
          name_th: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          image_url?: string | null
          name_en: string
          name_th: string
        }
        Update: {
          display_order?: number | null
          id?: string
          image_url?: string | null
          name_en?: string
          name_th?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          customer_segment: string | null
          first_seen_date: string | null
          id: string
          last_order_date: string | null
          nickname: string | null
          notes: string | null
          phone_number: string
          total_orders: number | null
          total_spend: number | null
        }
        Insert: {
          created_at?: string | null
          customer_segment?: string | null
          first_seen_date?: string | null
          id?: string
          last_order_date?: string | null
          nickname?: string | null
          notes?: string | null
          phone_number: string
          total_orders?: number | null
          total_spend?: number | null
        }
        Update: {
          created_at?: string | null
          customer_segment?: string | null
          first_seen_date?: string | null
          id?: string
          last_order_date?: string | null
          nickname?: string | null
          notes?: string | null
          phone_number?: string
          total_orders?: number | null
          total_spend?: number | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_name: string
          id: number
          session_id: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_name: string
          id?: number
          session_id?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_name?: string
          id?: number
          session_id?: string | null
          source?: string | null
        }
        Relationships: []
      }
      keep_alive: {
        Row: {
          bumped_at: string | null
          id: number
          message: string | null
        }
        Insert: {
          bumped_at?: string | null
          id?: number
          message?: string | null
        }
        Update: {
          bumped_at?: string | null
          id?: number
          message?: string | null
        }
        Relationships: []
      }
      menu_item_option_groups: {
        Row: {
          menu_item_id: string
          option_group_id: string
          sort_order: number | null
        }
        Insert: {
          menu_item_id: string
          option_group_id: string
          sort_order?: number | null
        }
        Update: {
          menu_item_id?: string
          option_group_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_option_groups_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_option_groups_option_group_id_fkey"
            columns: ["option_group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          description_en: string | null
          description_th: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_best_seller: boolean | null
          is_hero_in_category: boolean | null
          name_en: string
          name_th: string
        }
        Insert: {
          base_price: number
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_th?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_best_seller?: boolean | null
          is_hero_in_category?: boolean | null
          name_en: string
          name_th: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_th?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_best_seller?: boolean | null
          is_hero_in_category?: boolean | null
          name_en?: string
          name_th?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          group_name_en: string
          group_name_th: string
          id: string
          selection_type: string
        }
        Insert: {
          group_name_en: string
          group_name_th: string
          id?: string
          selection_type: string
        }
        Update: {
          group_name_en?: string
          group_name_th?: string
          id?: string
          selection_type?: string
        }
        Relationships: []
      }
      options: {
        Row: {
          display_order: number | null
          group_id: string
          icon_name: string | null
          id: string
          option_name_en: string
          option_name_th: string
          price_adjustment: number
        }
        Insert: {
          display_order?: number | null
          group_id: string
          icon_name?: string | null
          id?: string
          option_name_en: string
          option_name_th: string
          price_adjustment?: number
        }
        Update: {
          display_order?: number | null
          group_id?: string
          icon_name?: string | null
          id?: string
          option_name_en?: string
          option_name_th?: string
          price_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          customer_id: string | null
          delivery_fee: number | null
          discount_amount: number | null
          fulfillment_type: string
          grand_total: number
          id: string
          internal_notes: string | null
          items: Json
          order_date: string | null
          payment_method: string | null
          pickup_time: string | null
          platform_fee: number | null
          source: string | null
          status: string
          subtotal: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          delivery_fee?: number | null
          discount_amount?: number | null
          fulfillment_type: string
          grand_total: number
          id?: string
          internal_notes?: string | null
          items: Json
          order_date?: string | null
          payment_method?: string | null
          pickup_time?: string | null
          platform_fee?: number | null
          source?: string | null
          status?: string
          subtotal?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          delivery_fee?: number | null
          discount_amount?: number | null
          fulfillment_type?: string
          grand_total?: number
          id?: string
          internal_notes?: string | null
          items?: Json
          order_date?: string | null
          payment_method?: string | null
          pickup_time?: string | null
          platform_fee?: number | null
          source?: string | null
          status?: string
          subtotal?: number | null
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
      user_roles: {
        Row: {
          id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      master_menu_overview: {
        Row: {
          "ชื่อกลุ่ม Option": string | null
          ตัวเลือกย่อย: string | null
          "ประเภท (เลือกเดี่ยว/หลา": string | null
          เมนูอาหาร: string | null
          ราคาบวกเพิ่ม: number | null
          "ลำดับกลุ่ม (Group Order)": number | null
          "ลำดับตัวเลือก (Option Order)": number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
