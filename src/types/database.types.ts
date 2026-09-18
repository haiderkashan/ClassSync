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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_tasks: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_datetime: string
          id: string
          is_archived: boolean
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_datetime: string
          id?: string
          is_archived?: boolean
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_datetime?: string
          id?: string
          is_archived?: boolean
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_tasks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      base_schedule: {
        Row: {
          course_id: string
          created_at: string
          day_of_week: number
          end_time: string
          frequency: string
          id: string
          room: string | null
          session_type: string
          start_time: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          frequency?: string
          id?: string
          room?: string | null
          session_type?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          frequency?: string
          id?: string
          room?: string | null
          session_type?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_schedule_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          is_active: boolean
          is_guest: boolean
          is_muted: boolean
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_guest?: boolean
          is_muted?: boolean
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_guest?: boolean
          is_muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string | null
          color_hex: string
          created_at: string
          guest_invite_token: string
          id: string
          is_archived: boolean
          join_code: string | null
          name: string
          section_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          color_hex?: string
          created_at?: string
          guest_invite_token?: string
          id?: string
          is_archived?: boolean
          join_code?: string | null
          name: string
          section_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          color_hex?: string
          created_at?: string
          guest_invite_token?: string
          id?: string
          is_archived?: boolean
          join_code?: string | null
          name?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_exceptions: {
        Row: {
          base_schedule_id: string | null
          course_id: string
          created_at: string
          created_by: string | null
          custom_note: string | null
          delay_minutes: number
          exception_date: string
          id: string
          is_makeup: boolean
          makeup_end_time: string | null
          makeup_start_time: string | null
          new_room: string | null
          status: string
          updated_at: string
        }
        Insert: {
          base_schedule_id?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          custom_note?: string | null
          delay_minutes?: number
          exception_date: string
          id?: string
          is_makeup?: boolean
          makeup_end_time?: string | null
          makeup_start_time?: string | null
          new_room?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          base_schedule_id?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          custom_note?: string | null
          delay_minutes?: number
          exception_date?: string
          id?: string
          is_makeup?: boolean
          makeup_end_time?: string | null
          makeup_start_time?: string | null
          new_room?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_base_schedule_id_fkey"
            columns: ["base_schedule_id"]
            isOneToOne: false
            referencedRelation: "base_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      section_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          section_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          section_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          section_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_members_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_mode: string
          id: string
          institution_tag: string | null
          is_archived: boolean
          join_code: string
          name: string
          timezone: string
          updated_at: string
          week_a_anchor_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_mode?: string
          id?: string
          institution_tag?: string | null
          is_archived?: boolean
          join_code: string
          name: string
          timezone?: string
          updated_at?: string
          week_a_anchor_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_mode?: string
          id?: string
          institution_tag?: string | null
          is_archived?: boolean
          join_code?: string
          name?: string
          timezone?: string
          updated_at?: string
          week_a_anchor_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          expo_push_token: string
          id: string
          platform: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expo_push_token: string
          id?: string
          platform?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expo_push_token?: string
          id?: string
          platform?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_task_completions: {
        Row: {
          completed_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "academic_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_section: { Args: { p_section_id: string }; Returns: boolean }
      create_course: {
        Args: { p_join_code: string; p_section_id: string; p_title: string }
        Returns: string
      }
      current_user_id: { Args: never; Returns: string }
      is_course_enrolled: { Args: { c_id: string }; Returns: boolean }
      is_section_admin: { Args: { sec_id: string }; Returns: boolean }
      is_section_member: { Args: { sec_id: string }; Returns: boolean }
      join_course_guest: { Args: { p_join_code: string }; Returns: string }
      join_section_via_code: { Args: { p_join_code: string }; Returns: string }
      leave_course_guest: { Args: { p_course_id: string }; Returns: boolean }
      leave_section: { Args: { p_section_id: string }; Returns: boolean }
      remove_section_member: {
        Args: { p_section_id: string; p_target_user_id: string }
        Returns: boolean
      }
      transfer_section_ownership: {
        Args: { p_new_cr_user_id: string; p_section_id: string }
        Returns: boolean
      }
      update_member_role: {
        Args: {
          p_new_role: string
          p_section_id: string
          p_target_user_id: string
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
