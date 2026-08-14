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
      app_role_def: {
        Row: {
          created_at: string
          description: string | null
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      nfa_attachment_view: {
        Row: {
          action: string
          attachment_id: string
          id: string
          nfa_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          action: string
          attachment_id: string
          id?: string
          nfa_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          action?: string
          attachment_id?: string
          id?: string
          nfa_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfa_attachment_view_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "nfa_attachment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfa_attachment_view_nfa_id_fkey"
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
          action_kind: string | null
          actor_id: string | null
          approver_name: string | null
          at: string
          comment: string | null
          id: string
          level: number | null
          new_status: string | null
          nfa_id: string
          old_status: string | null
        }
        Insert: {
          action: string
          action_kind?: string | null
          actor_id?: string | null
          approver_name?: string | null
          at?: string
          comment?: string | null
          id?: string
          level?: number | null
          new_status?: string | null
          nfa_id: string
          old_status?: string | null
        }
        Update: {
          action?: string
          action_kind?: string | null
          actor_id?: string | null
          approver_name?: string | null
          at?: string
          comment?: string | null
          id?: string
          level?: number | null
          new_status?: string | null
          nfa_id?: string
          old_status?: string | null
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
          department: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string
          is_active: boolean
          username: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          username?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          username?: string | null
        }
        Relationships: []
      }
      role_permission: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          role_key: string | null
          screen: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          role_key?: string | null
          screen: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          role_key?: string | null
          screen?: string
          updated_at?: string
        }
        Relationships: []
      }
      sap_attachment: {
        Row: {
          enfa_number: string
          filename: string
          id: string
          mime: string | null
          size: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          enfa_number: string
          filename: string
          id?: string
          mime?: string | null
          size?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          enfa_number?: string
          filename?: string
          id?: string
          mime?: string | null
          size?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      sap_connection: {
        Row: {
          base_url: string
          created_at: string
          environment: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          base_url?: string
          created_at?: string
          environment?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          environment?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      sap_endpoint: {
        Row: {
          active: boolean
          api_type: string
          auth_type: string
          created_at: string
          description: string | null
          http_method: string
          id: string
          last_synced_at: string | null
          last_test_at: string | null
          last_test_body: string | null
          last_test_error: string | null
          last_test_ms: number | null
          last_test_ok: boolean | null
          last_test_status: number | null
          module: string
          name: string
          path_or_url: string
          request_body: string | null
          request_headers: Json
          request_query: Json
          schedule_cron: string | null
          schedule_enabled: boolean
          system_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          active?: boolean
          api_type?: string
          auth_type?: string
          created_at?: string
          description?: string | null
          http_method?: string
          id?: string
          last_synced_at?: string | null
          last_test_at?: string | null
          last_test_body?: string | null
          last_test_error?: string | null
          last_test_ms?: number | null
          last_test_ok?: boolean | null
          last_test_status?: number | null
          module?: string
          name: string
          path_or_url?: string
          request_body?: string | null
          request_headers?: Json
          request_query?: Json
          schedule_cron?: string | null
          schedule_enabled?: boolean
          system_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          active?: boolean
          api_type?: string
          auth_type?: string
          created_at?: string
          description?: string | null
          http_method?: string
          id?: string
          last_synced_at?: string | null
          last_test_at?: string | null
          last_test_body?: string | null
          last_test_error?: string | null
          last_test_ms?: number | null
          last_test_ok?: boolean | null
          last_test_status?: number | null
          module?: string
          name?: string
          path_or_url?: string
          request_body?: string | null
          request_headers?: Json
          request_query?: Json
          schedule_cron?: string | null
          schedule_enabled?: boolean
          system_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sap_endpoint_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "sap_system"
            referencedColumns: ["id"]
          },
        ]
      }
      sap_middleware_config: {
        Row: {
          connection_mode: string
          created_at: string
          deployment_mode: string
          id: string
          port: number
          updated_at: string
          url: string
        }
        Insert: {
          connection_mode?: string
          created_at?: string
          deployment_mode?: string
          id?: string
          port?: number
          updated_at?: string
          url?: string
        }
        Update: {
          connection_mode?: string
          created_at?: string
          deployment_mode?: string
          id?: string
          port?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      sap_record_draft: {
        Row: {
          budget_impact: number | null
          created_at: string
          detailed_description: string | null
          enfa_number: string
          scope_impact: string | null
          subject: string | null
          timeline_days: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budget_impact?: number | null
          created_at?: string
          detailed_description?: string | null
          enfa_number: string
          scope_impact?: string | null
          subject?: string | null
          timeline_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budget_impact?: number | null
          created_at?: string
          detailed_description?: string | null
          enfa_number?: string
          scope_impact?: string | null
          subject?: string | null
          timeline_days?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sap_secret: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      sap_system: {
        Row: {
          base_path: string
          created_at: string
          environment: string
          host: string
          id: string
          is_active: boolean
          key: string
          label: string
          notes: string | null
          port: number
          protocol: string
          route_via_middleware: boolean
          sap_client: string
          updated_at: string
          username: string
        }
        Insert: {
          base_path?: string
          created_at?: string
          environment?: string
          host?: string
          id?: string
          is_active?: boolean
          key: string
          label?: string
          notes?: string | null
          port?: number
          protocol?: string
          route_via_middleware?: boolean
          sap_client?: string
          updated_at?: string
          username?: string
        }
        Update: {
          base_path?: string
          created_at?: string
          environment?: string
          host?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          notes?: string | null
          port?: number
          protocol?: string
          route_via_middleware?: boolean
          sap_client?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      sap_test_log: {
        Row: {
          actor_id: string | null
          created_at: string
          endpoint_id: string | null
          id: string
          latency_ms: number | null
          message: string | null
          ok: boolean
          status: number | null
          target: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          endpoint_id?: string | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          ok?: boolean
          status?: number | null
          target: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          endpoint_id?: string | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          ok?: boolean
          status?: number | null
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "sap_test_log_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "sap_endpoint"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignment: {
        Row: {
          created_at: string
          id: string
          role_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignment_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "app_role_def"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profiles_basic: {
        Args: { _ids: string[] }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      nfa_act: {
        Args: { _action: string; _comment?: string; _nfa_id: string }
        Returns: undefined
      }
      nfa_resubmit: {
        Args: { _comment?: string; _nfa_id: string }
        Returns: undefined
      }
      resolve_login_email: { Args: { _login: string }; Returns: string }
      resolve_users_by_email: {
        Args: { _emails: string[] }
        Returns: {
          email: string
          id: string
        }[]
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
