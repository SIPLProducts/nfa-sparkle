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
      nfa: {
        Row: {
          budget_impact: number | null
          company: string
          created_at: string
          current_level: number
          detailed_description: string | null
          enfa_number: string
          function: string | null
          id: string
          initiator_id: string
          nfa_type: string
          plant: string | null
          plant_name: string | null
          project: string | null
          scope_impact: string | null
          status: Database["public"]["Enums"]["nfa_status"]
          subject: string
          timeline_days: number | null
          updated_at: string
        }
        Insert: {
          budget_impact?: number | null
          company: string
          created_at?: string
          current_level?: number
          detailed_description?: string | null
          enfa_number?: string
          function?: string | null
          id?: string
          initiator_id: string
          nfa_type: string
          plant?: string | null
          plant_name?: string | null
          project?: string | null
          scope_impact?: string | null
          status?: Database["public"]["Enums"]["nfa_status"]
          subject: string
          timeline_days?: number | null
          updated_at?: string
        }
        Update: {
          budget_impact?: number | null
          company?: string
          created_at?: string
          current_level?: number
          detailed_description?: string | null
          enfa_number?: string
          function?: string | null
          id?: string
          initiator_id?: string
          nfa_type?: string
          plant?: string | null
          plant_name?: string | null
          project?: string | null
          scope_impact?: string | null
          status?: Database["public"]["Enums"]["nfa_status"]
          subject?: string
          timeline_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      nfa_approver: {
        Row: {
          acted_at: string | null
          approver_id: string
          comment: string | null
          created_at: string
          designation: string | null
          id: string
          level: number
          nfa_id: string
          status: Database["public"]["Enums"]["approver_status"]
        }
        Insert: {
          acted_at?: string | null
          approver_id: string
          comment?: string | null
          created_at?: string
          designation?: string | null
          id?: string
          level: number
          nfa_id: string
          status?: Database["public"]["Enums"]["approver_status"]
        }
        Update: {
          acted_at?: string | null
          approver_id?: string
          comment?: string | null
          created_at?: string
          designation?: string | null
          id?: string
          level?: number
          nfa_id?: string
          status?: Database["public"]["Enums"]["approver_status"]
        }
        Relationships: [
          {
            foreignKeyName: "nfa_approver_nfa_id_fkey"
            columns: ["nfa_id"]
            isOneToOne: false
            referencedRelation: "nfa"
            referencedColumns: ["id"]
          },
        ]
      }
      nfa_attachment: {
        Row: {
          filename: string
          id: string
          mime: string | null
          nfa_id: string
          size: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          filename: string
          id?: string
          mime?: string | null
          nfa_id: string
          size?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          filename?: string
          id?: string
          mime?: string | null
          nfa_id?: string
          size?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfa_attachment_nfa_id_fkey"
            columns: ["nfa_id"]
            isOneToOne: false
            referencedRelation: "nfa"
            referencedColumns: ["id"]
          },
        ]
      }
      nfa_audit: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          comment: string | null
          id: string
          nfa_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          comment?: string | null
          id?: string
          nfa_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          comment?: string | null
          id?: string
          nfa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfa_audit_nfa_id_fkey"
            columns: ["nfa_id"]
            isOneToOne: false
            referencedRelation: "nfa"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
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
      is_nfa_approver: {
        Args: { _nfa_id: string; _user_id: string }
        Returns: boolean
      }
      nfa_act: {
        Args: { _action: string; _comment?: string; _nfa_id: string }
        Returns: undefined
      }
      nfa_resubmit: {
        Args: { _comment?: string; _nfa_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "initiator" | "approver" | "admin" | "viewer"
      approver_status:
        | "pending"
        | "approved"
        | "rejected"
        | "sent_back"
        | "clarification"
      nfa_status:
        | "with_initiator"
        | "in_process"
        | "clarification"
        | "completed"
        | "rejected"
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
      app_role: ["initiator", "approver", "admin", "viewer"],
      approver_status: [
        "pending",
        "approved",
        "rejected",
        "sent_back",
        "clarification",
      ],
      nfa_status: [
        "with_initiator",
        "in_process",
        "clarification",
        "completed",
        "rejected",
      ],
    },
  },
} as const
