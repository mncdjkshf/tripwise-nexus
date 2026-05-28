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
      drivers: {
        Row: {
          car_number: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          driving_license: string | null
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean
          last_ping: string | null
          personal_details_json: Json | null
          phone_number: string | null
          rating: number
          status: Database["public"]["Enums"]["driver_status"]
          total_earnings: number
          total_rides: number
          updated_at: string
          user_id: string
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          car_number?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          driving_license?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          last_ping?: string | null
          personal_details_json?: Json | null
          phone_number?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["driver_status"]
          total_earnings?: number
          total_rides?: number
          updated_at?: string
          user_id: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Update: {
          car_number?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          driving_license?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          last_ping?: string | null
          personal_details_json?: Json | null
          phone_number?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["driver_status"]
          total_earnings?: number
          total_rides?: number
          updated_at?: string
          user_id?: string
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          channel: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          identifier: string
          otp_code: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          otp_code: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          otp_code?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          is_validated: boolean
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_validated?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_validated?: boolean
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          distance_km: number
          driver_id: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min: number
          fare: number
          id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          rating: number | null
          requested_at: string
          ride_type: Database["public"]["Enums"]["ride_type"]
          rider_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number
          driver_id?: string | null
          dropoff_address: string
          dropoff_lat: number
          dropoff_lng: number
          duration_min?: number
          fare?: number
          id?: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          rating?: number | null
          requested_at?: string
          ride_type?: Database["public"]["Enums"]["ride_type"]
          rider_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number
          driver_id?: string | null
          dropoff_address?: string
          dropoff_lat?: number
          dropoff_lng?: number
          duration_min?: number
          fare?: number
          id?: string
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          rating?: number | null
          requested_at?: string
          ride_type?: Database["public"]["Enums"]["ride_type"]
          rider_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string
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
      drivers_public: {
        Row: {
          car_number: string | null
          current_lat: number | null
          current_lng: number | null
          full_name: string | null
          id: string | null
          is_approved: boolean | null
          last_ping: string | null
          rating: number | null
          status: Database["public"]["Enums"]["driver_status"] | null
          user_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: string | null
        }
        Insert: {
          car_number?: string | null
          current_lat?: number | null
          current_lng?: number | null
          full_name?: string | null
          id?: string | null
          is_approved?: boolean | null
          last_ping?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          user_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
        }
        Update: {
          car_number?: string | null
          current_lat?: number | null
          current_lng?: number | null
          full_name?: string | null
          id?: string | null
          is_approved?: boolean | null
          last_ping?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          user_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
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
      app_role: "admin" | "driver" | "rider"
      driver_status: "offline" | "online" | "on_ride"
      ride_status:
        | "requested"
        | "accepted"
        | "arriving"
        | "in_progress"
        | "completed"
        | "cancelled"
      ride_type: "economy" | "premium" | "bike" | "suv"
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
      app_role: ["admin", "driver", "rider"],
      driver_status: ["offline", "online", "on_ride"],
      ride_status: [
        "requested",
        "accepted",
        "arriving",
        "in_progress",
        "completed",
        "cancelled",
      ],
      ride_type: ["economy", "premium", "bike", "suv"],
    },
  },
} as const
