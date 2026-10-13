export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      inventory: {
        Row: {
          cost: number;
          created_at: string;
          id: string;
          min_level: number;
          name_ar: string;
          quantity: number;
          unit: string;
          updated_at: string;
        };
        Insert: {
          cost?: number;
          created_at?: string;
          id?: string;
          min_level?: number;
          name_ar: string;
          quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          id?: string;
          min_level?: number;
          name_ar?: string;
          quantity?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_transactions: {
        Row: {
          created_at: string;
          id: string;
          inventory_id: string;
          note: string | null;
          quantity: number;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inventory_id: string;
          note?: string | null;
          quantity: number;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          inventory_id?: string;
          note?: string | null;
          quantity?: number;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "inventory";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_categories: {
        Row: {
          created_at: string;
          id: string;
          name_ar: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name_ar: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name_ar?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          image_url: string | null;
          is_available: boolean;
          name_ar: string;
          price: number;
          ingredients: Json;
          inventory_tracking: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name_ar: string;
          price: number;
          ingredients?: Json;
          inventory_tracking?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name_ar?: string;
          price?: number;
          ingredients?: Json;
          inventory_tracking?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "menu_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          id: string;
          items: Json;
          notes: string | null;
          order_number: number;
          order_type: string;
          payment_method: string;
          status: string;
          subtotal: number;
          table_id: string | null;
          tax: number;
          total: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          items: Json;
          notes?: string | null;
          order_number?: number;
          order_type?: string;
          payment_method: string;
          status?: string;
          subtotal: number;
          table_id?: string | null;
          tax: number;
          total: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          items?: Json;
          notes?: string | null;
          order_number?: number;
          order_type?: string;
          payment_method?: string;
          status?: string;
          subtotal?: number;
          table_id?: string | null;
          tax?: number;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          permissions: Json;
          phone: string | null;
          role: string;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          permissions?: Json;
          phone?: string | null;
          role?: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          permissions?: Json;
          phone?: string | null;
          role?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      tables: {
        Row: {
          capacity: number;
          created_at: string;
          id: string;
          name: string | null;
          number: number;
          status: string;
        };
        Insert: {
          capacity?: number;
          created_at?: string;
          id?: string;
          name?: string | null;
          number: number;
          status?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          id?: string;
          name?: string | null;
          number?: number;
          status?: string;
        };
        Relationships: [];
      };
      shift_audit_logs: {
        Row: {
          id: string;
          shift_id: string;
          shift_type: "park" | "restaurant";
          shift_number: string;
          auto_shift_number: string | null;
          action: string;
          status_before: string | null;
          status_after: string | null;
          cashier_name: string | null;
          cashier_id: string | null;
          performed_by: string | null;
          user_id: string | null;
          user_email: string | null;
          details: string | null;
          metadata: Json;
          client_timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          shift_type: "park" | "restaurant";
          shift_number: string;
          auto_shift_number?: string | null;
          action: string;
          status_before?: string | null;
          status_after?: string | null;
          cashier_name?: string | null;
          cashier_id?: string | null;
          performed_by?: string | null;
          user_id?: string | null;
          user_email?: string | null;
          details?: string | null;
          metadata?: Json;
          client_timestamp?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          shift_type?: "park" | "restaurant";
          shift_number?: string;
          auto_shift_number?: string | null;
          action?: string;
          status_before?: string | null;
          status_after?: string | null;
          cashier_name?: string | null;
          cashier_id?: string | null;
          performed_by?: string | null;
          user_id?: string | null;
          user_email?: string | null;
          details?: string | null;
          metadata?: Json;
          client_timestamp?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_managed_user: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
