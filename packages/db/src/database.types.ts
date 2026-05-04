// Auto-generated Supabase types — do NOT edit by hand.
// Regenerate with: pnpm --filter @origin-one/db db:gen-types
// (or via the Supabase MCP `generate_typescript_types`).

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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      ActionItem: {
        Row: {
          assignedTo: string | null
          createdAt: string
          department: string | null
          description: string | null
          dueDate: string | null
          id: string
          mentions: string[]
          projectId: string
          status: Database["public"]["Enums"]["ActionItemStatus"]
          title: string
          updatedAt: string
        }
        Insert: {
          assignedTo?: string | null
          createdAt?: string
          department?: string | null
          description?: string | null
          dueDate?: string | null
          id?: string
          mentions?: string[]
          projectId: string
          status?: Database["public"]["Enums"]["ActionItemStatus"]
          title: string
          updatedAt?: string
        }
        Update: {
          assignedTo?: string | null
          createdAt?: string
          department?: string | null
          description?: string | null
          dueDate?: string | null
          id?: string
          mentions?: string[]
          projectId?: string
          status?: Database["public"]["Enums"]["ActionItemStatus"]
          title?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ActionItem_assignedTo_fkey"
            columns: ["assignedTo"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ActionItem_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Budget: {
        Row: {
          clonedFromProjectId: string | null
          createdAt: string
          currency: string
          id: string
          projectId: string
          rateSourceVersionId: string | null
          updatedAt: string
          varianceThreshold: number
        }
        Insert: {
          clonedFromProjectId?: string | null
          createdAt?: string
          currency?: string
          id: string
          projectId: string
          rateSourceVersionId?: string | null
          updatedAt?: string
          varianceThreshold?: number
        }
        Update: {
          clonedFromProjectId?: string | null
          createdAt?: string
          currency?: string
          id?: string
          projectId?: string
          rateSourceVersionId?: string | null
          updatedAt?: string
          varianceThreshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "Budget_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      BudgetAccount: {
        Row: {
          budgetId: string
          code: string
          createdAt: string
          id: string
          name: string
          parentId: string | null
          section: Database["public"]["Enums"]["BudgetAccountSection"]
          sortOrder: number
          updatedAt: string
        }
        Insert: {
          budgetId: string
          code: string
          createdAt?: string
          id: string
          name: string
          parentId?: string | null
          section?: Database["public"]["Enums"]["BudgetAccountSection"]
          sortOrder: number
          updatedAt?: string
        }
        Update: {
          budgetId?: string
          code?: string
          createdAt?: string
          id?: string
          name?: string
          parentId?: string | null
          section?: Database["public"]["Enums"]["BudgetAccountSection"]
          sortOrder?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "BudgetAccount_budgetId_fkey"
            columns: ["budgetId"]
            isOneToOne: false
            referencedRelation: "Budget"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BudgetAccount_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "BudgetAccount"
            referencedColumns: ["id"]
          },
        ]
      }
      BudgetLine: {
        Row: {
          accountId: string
          actualsRate: number | null
          budgetId: string
          createdAt: string
          description: string
          fringeRate: number
          id: string
          sortOrder: number
          tags: string[] | null
          unit: Database["public"]["Enums"]["BudgetUnit"]
          updatedAt: string
        }
        Insert: {
          accountId: string
          actualsRate?: number | null
          budgetId: string
          createdAt?: string
          description: string
          fringeRate?: number
          id: string
          sortOrder: number
          tags?: string[] | null
          unit: Database["public"]["Enums"]["BudgetUnit"]
          updatedAt?: string
        }
        Update: {
          accountId?: string
          actualsRate?: number | null
          budgetId?: string
          createdAt?: string
          description?: string
          fringeRate?: number
          id?: string
          sortOrder?: number
          tags?: string[] | null
          unit?: Database["public"]["Enums"]["BudgetUnit"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "BudgetLine_accountId_fkey"
            columns: ["accountId"]
            isOneToOne: false
            referencedRelation: "BudgetAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BudgetLine_budgetId_fkey"
            columns: ["budgetId"]
            isOneToOne: false
            referencedRelation: "Budget"
            referencedColumns: ["id"]
          },
        ]
      }
      BudgetLineAmount: {
        Row: {
          createdAt: string
          id: string
          lineId: string
          notes: string | null
          qty: string
          rate: number
          updatedAt: string
          versionId: string
        }
        Insert: {
          createdAt?: string
          id: string
          lineId: string
          notes?: string | null
          qty?: string
          rate?: number
          updatedAt?: string
          versionId: string
        }
        Update: {
          createdAt?: string
          id?: string
          lineId?: string
          notes?: string | null
          qty?: string
          rate?: number
          updatedAt?: string
          versionId?: string
        }
        Relationships: [
          {
            foreignKeyName: "BudgetLineAmount_lineId_fkey"
            columns: ["lineId"]
            isOneToOne: false
            referencedRelation: "BudgetLine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BudgetLineAmount_versionId_fkey"
            columns: ["versionId"]
            isOneToOne: false
            referencedRelation: "BudgetVersion"
            referencedColumns: ["id"]
          },
        ]
      }
      BudgetMarkup: {
        Row: {
          accountId: string | null
          appliesTo: Database["public"]["Enums"]["MarkupTarget"]
          budgetId: string
          createdAt: string
          id: string
          name: string
          percent: number
          sortOrder: number
          updatedAt: string
          versionId: string | null
        }
        Insert: {
          accountId?: string | null
          appliesTo: Database["public"]["Enums"]["MarkupTarget"]
          budgetId: string
          createdAt?: string
          id: string
          name: string
          percent: number
          sortOrder: number
          updatedAt?: string
          versionId?: string | null
        }
        Update: {
          accountId?: string | null
          appliesTo?: Database["public"]["Enums"]["MarkupTarget"]
          budgetId?: string
          createdAt?: string
          id?: string
          name?: string
          percent?: number
          sortOrder?: number
          updatedAt?: string
          versionId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "BudgetMarkup_accountId_fkey"
            columns: ["accountId"]
            isOneToOne: false
            referencedRelation: "BudgetAccount"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BudgetMarkup_budgetId_fkey"
            columns: ["budgetId"]
            isOneToOne: false
            referencedRelation: "Budget"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BudgetMarkup_versionId_fkey"
            columns: ["versionId"]
            isOneToOne: false
            referencedRelation: "BudgetVersion"
            referencedColumns: ["id"]
          },
        ]
      }
      BudgetVariable: {
        Row: {
          budgetId: string
          createdAt: string
          id: string
          name: string
          notes: string | null
          updatedAt: string
          value: string
          versionId: string | null
        }
        Insert: {
          budgetId: string
          createdAt?: string
          id: string
          name: string
          notes?: string | null
          updatedAt?: string
          value: string
          versionId?: string | null
        }
        Update: {
          budgetId?: string
          createdAt?: string
          id?: string
          name?: string
          notes?: string | null
          updatedAt?: string
          value?: string
          versionId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "BudgetVariable_budgetId_fkey"
            columns: ["budgetId"]
            isOneToOne: false
            referencedRelation: "Budget"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BudgetVariable_versionId_fkey"
            columns: ["versionId"]
            isOneToOne: false
            referencedRelation: "BudgetVersion"
            referencedColumns: ["id"]
          },
        ]
      }
      BudgetVersion: {
        Row: {
          budgetId: string
          createdAt: string
          id: string
          kind: Database["public"]["Enums"]["BudgetVersionKind"]
          lockedAt: string | null
          lockedBy: string | null
          name: string
          sortOrder: number
          state: Database["public"]["Enums"]["BudgetVersionState"]
          updatedAt: string
        }
        Insert: {
          budgetId: string
          createdAt?: string
          id: string
          kind: Database["public"]["Enums"]["BudgetVersionKind"]
          lockedAt?: string | null
          lockedBy?: string | null
          name: string
          sortOrder: number
          state?: Database["public"]["Enums"]["BudgetVersionState"]
          updatedAt?: string
        }
        Update: {
          budgetId?: string
          createdAt?: string
          id?: string
          kind?: Database["public"]["Enums"]["BudgetVersionKind"]
          lockedAt?: string | null
          lockedBy?: string | null
          name?: string
          sortOrder?: number
          state?: Database["public"]["Enums"]["BudgetVersionState"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "BudgetVersion_budgetId_fkey"
            columns: ["budgetId"]
            isOneToOne: false
            referencedRelation: "Budget"
            referencedColumns: ["id"]
          },
        ]
      }
      CallSheet: {
        Row: {
          attachmentPaths: string[]
          createdAt: string
          crewCallTime: string | null
          customFromEmail: string | null
          customFromName: string | null
          episodeOrEvent: string | null
          estWrapTime: string | null
          generalCallTime: string | null
          id: string
          includeSchedule: boolean
          lunchTime: string | null
          nearestHospitalAddress: string | null
          nearestHospitalName: string | null
          nearestHospitalPhone: string | null
          parkingNotes: string | null
          productionNotes: string | null
          projectId: string
          publishedAt: string | null
          replyToEmail: string | null
          shootDayId: string
          shootingCallTime: string | null
          status: Database["public"]["Enums"]["CallSheetStatus"]
          subtitle: string | null
          sunriseTime: string | null
          sunsetTime: string | null
          title: string | null
          updatedAt: string
          weatherCondition: string | null
          weatherTempHigh: number | null
          weatherTempLow: number | null
        }
        Insert: {
          attachmentPaths?: string[]
          createdAt?: string
          crewCallTime?: string | null
          customFromEmail?: string | null
          customFromName?: string | null
          episodeOrEvent?: string | null
          estWrapTime?: string | null
          generalCallTime?: string | null
          id?: string
          includeSchedule?: boolean
          lunchTime?: string | null
          nearestHospitalAddress?: string | null
          nearestHospitalName?: string | null
          nearestHospitalPhone?: string | null
          parkingNotes?: string | null
          productionNotes?: string | null
          projectId: string
          publishedAt?: string | null
          replyToEmail?: string | null
          shootDayId: string
          shootingCallTime?: string | null
          status?: Database["public"]["Enums"]["CallSheetStatus"]
          subtitle?: string | null
          sunriseTime?: string | null
          sunsetTime?: string | null
          title?: string | null
          updatedAt?: string
          weatherCondition?: string | null
          weatherTempHigh?: number | null
          weatherTempLow?: number | null
        }
        Update: {
          attachmentPaths?: string[]
          createdAt?: string
          crewCallTime?: string | null
          customFromEmail?: string | null
          customFromName?: string | null
          episodeOrEvent?: string | null
          estWrapTime?: string | null
          generalCallTime?: string | null
          id?: string
          includeSchedule?: boolean
          lunchTime?: string | null
          nearestHospitalAddress?: string | null
          nearestHospitalName?: string | null
          nearestHospitalPhone?: string | null
          parkingNotes?: string | null
          productionNotes?: string | null
          projectId?: string
          publishedAt?: string | null
          replyToEmail?: string | null
          shootDayId?: string
          shootingCallTime?: string | null
          status?: Database["public"]["Enums"]["CallSheetStatus"]
          subtitle?: string | null
          sunriseTime?: string | null
          sunsetTime?: string | null
          title?: string | null
          updatedAt?: string
          weatherCondition?: string | null
          weatherTempHigh?: number | null
          weatherTempLow?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "CallSheet_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CallSheet_shootDayId_fkey"
            columns: ["shootDayId"]
            isOneToOne: false
            referencedRelation: "ShootDay"
            referencedColumns: ["id"]
          },
        ]
      }
      CallSheetDelivery: {
        Row: {
          bouncedAt: string | null
          channel: Database["public"]["Enums"]["CallSheetDeliveryChannel"]
          clickedAt: string | null
          confirmedAt: string | null
          confirmToken: string
          createdAt: string
          declinedAt: string | null
          deliveredAt: string | null
          externalId: string | null
          failedReason: string | null
          id: string
          openedAt: string | null
          outdatedAt: string | null
          personalizedSnapshot: Json | null
          provider: Database["public"]["Enums"]["CallSheetDeliveryProvider"]
          recipientId: string
          scheduledFor: string | null
          sentAt: string | null
          status: Database["public"]["Enums"]["CallSheetDeliveryStatus"]
          updatedAt: string
        }
        Insert: {
          bouncedAt?: string | null
          channel: Database["public"]["Enums"]["CallSheetDeliveryChannel"]
          clickedAt?: string | null
          confirmedAt?: string | null
          confirmToken?: string
          createdAt?: string
          declinedAt?: string | null
          deliveredAt?: string | null
          externalId?: string | null
          failedReason?: string | null
          id?: string
          openedAt?: string | null
          outdatedAt?: string | null
          personalizedSnapshot?: Json | null
          provider: Database["public"]["Enums"]["CallSheetDeliveryProvider"]
          recipientId: string
          scheduledFor?: string | null
          sentAt?: string | null
          status?: Database["public"]["Enums"]["CallSheetDeliveryStatus"]
          updatedAt?: string
        }
        Update: {
          bouncedAt?: string | null
          channel?: Database["public"]["Enums"]["CallSheetDeliveryChannel"]
          clickedAt?: string | null
          confirmedAt?: string | null
          confirmToken?: string
          createdAt?: string
          declinedAt?: string | null
          deliveredAt?: string | null
          externalId?: string | null
          failedReason?: string | null
          id?: string
          openedAt?: string | null
          outdatedAt?: string | null
          personalizedSnapshot?: Json | null
          provider?: Database["public"]["Enums"]["CallSheetDeliveryProvider"]
          recipientId?: string
          scheduledFor?: string | null
          sentAt?: string | null
          status?: Database["public"]["Enums"]["CallSheetDeliveryStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CallSheetDelivery_recipientId_fkey"
            columns: ["recipientId"]
            isOneToOne: false
            referencedRelation: "CallSheetRecipient"
            referencedColumns: ["id"]
          },
        ]
      }
      CallSheetRecipient: {
        Row: {
          callSheetId: string
          callTimeOverride: string | null
          createdAt: string
          excluded: boolean
          freeformEmail: string | null
          freeformName: string | null
          freeformPhone: string | null
          freeformRole: string | null
          id: string
          kind: Database["public"]["Enums"]["CallSheetRecipientKind"]
          projectMemberId: string | null
          sendEmail: boolean
          sendSms: boolean
          talentId: string | null
          updatedAt: string
        }
        Insert: {
          callSheetId: string
          callTimeOverride?: string | null
          createdAt?: string
          excluded?: boolean
          freeformEmail?: string | null
          freeformName?: string | null
          freeformPhone?: string | null
          freeformRole?: string | null
          id?: string
          kind: Database["public"]["Enums"]["CallSheetRecipientKind"]
          projectMemberId?: string | null
          sendEmail?: boolean
          sendSms?: boolean
          talentId?: string | null
          updatedAt?: string
        }
        Update: {
          callSheetId?: string
          callTimeOverride?: string | null
          createdAt?: string
          excluded?: boolean
          freeformEmail?: string | null
          freeformName?: string | null
          freeformPhone?: string | null
          freeformRole?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["CallSheetRecipientKind"]
          projectMemberId?: string | null
          sendEmail?: boolean
          sendSms?: boolean
          talentId?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CallSheetRecipient_callSheetId_fkey"
            columns: ["callSheetId"]
            isOneToOne: false
            referencedRelation: "CallSheet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CallSheetRecipient_projectMemberId_fkey"
            columns: ["projectMemberId"]
            isOneToOne: false
            referencedRelation: "ProjectMember"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CallSheetRecipient_talentId_fkey"
            columns: ["talentId"]
            isOneToOne: false
            referencedRelation: "Talent"
            referencedColumns: ["id"]
          },
        ]
      }
      ChatChannel: {
        Row: {
          createdAt: string
          id: string
          name: string
          projectId: string
          sortOrder: number
        }
        Insert: {
          createdAt?: string
          id: string
          name: string
          projectId: string
          sortOrder?: number
        }
        Update: {
          createdAt?: string
          id?: string
          name?: string
          projectId?: string
          sortOrder?: number
        }
        Relationships: [
          {
            foreignKeyName: "ChatChannel_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      ChatMessage: {
        Row: {
          channelId: string | null
          content: string
          createdAt: string
          id: string
          mentions: string[]
          projectId: string
          recipientId: string | null
          senderId: string
        }
        Insert: {
          channelId?: string | null
          content: string
          createdAt?: string
          id: string
          mentions?: string[]
          projectId: string
          recipientId?: string | null
          senderId: string
        }
        Update: {
          channelId?: string | null
          content?: string
          createdAt?: string
          id?: string
          mentions?: string[]
          projectId?: string
          recipientId?: string | null
          senderId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ChatMessage_channelId_fkey"
            columns: ["channelId"]
            isOneToOne: false
            referencedRelation: "ChatChannel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ChatMessage_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ChatMessage_recipientId_fkey"
            columns: ["recipientId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ChatMessage_senderId_fkey"
            columns: ["senderId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      CrewTimecard: {
        Row: {
          approvedAt: string | null
          approvedBy: string | null
          createdAt: string
          crewMemberId: string
          date: string
          description: string
          hours: number
          id: string
          lineItemId: string | null
          projectId: string
          rate: number | null
          rateUnit: Database["public"]["Enums"]["RateUnit"] | null
          reopenedAt: string | null
          reopenedBy: string | null
          reopenReason: string | null
          status: Database["public"]["Enums"]["TimecardStatus"]
          submittedAt: string | null
          updatedAt: string
        }
        Insert: {
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string
          crewMemberId: string
          date: string
          description: string
          hours: number
          id: string
          lineItemId?: string | null
          projectId: string
          rate?: number | null
          rateUnit?: Database["public"]["Enums"]["RateUnit"] | null
          reopenedAt?: string | null
          reopenedBy?: string | null
          reopenReason?: string | null
          status?: Database["public"]["Enums"]["TimecardStatus"]
          submittedAt?: string | null
          updatedAt?: string
        }
        Update: {
          approvedAt?: string | null
          approvedBy?: string | null
          createdAt?: string
          crewMemberId?: string
          date?: string
          description?: string
          hours?: number
          id?: string
          lineItemId?: string | null
          projectId?: string
          rate?: number | null
          rateUnit?: Database["public"]["Enums"]["RateUnit"] | null
          reopenedAt?: string | null
          reopenedBy?: string | null
          reopenReason?: string | null
          status?: Database["public"]["Enums"]["TimecardStatus"]
          submittedAt?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CrewTimecard_approvedBy_fkey"
            columns: ["approvedBy"]
            isOneToOne: false
            referencedRelation: "ProjectMember"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CrewTimecard_crewMemberId_fkey"
            columns: ["crewMemberId"]
            isOneToOne: false
            referencedRelation: "ProjectMember"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CrewTimecard_lineItemId_fkey"
            columns: ["lineItemId"]
            isOneToOne: false
            referencedRelation: "BudgetLine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CrewTimecard_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CrewTimecard_reopenedBy_fkey"
            columns: ["reopenedBy"]
            isOneToOne: false
            referencedRelation: "ProjectMember"
            referencedColumns: ["id"]
          },
        ]
      }
      Deliverable: {
        Row: {
          aspectRatio: string | null
          colorSpace: string | null
          createdAt: string
          format: string | null
          id: string
          length: string | null
          notes: string | null
          projectId: string
          resolution: string | null
          sortOrder: number
          soundSpecs: string | null
          title: string
          updatedAt: string
        }
        Insert: {
          aspectRatio?: string | null
          colorSpace?: string | null
          createdAt?: string
          format?: string | null
          id: string
          length?: string | null
          notes?: string | null
          projectId: string
          resolution?: string | null
          sortOrder?: number
          soundSpecs?: string | null
          title: string
          updatedAt?: string
        }
        Update: {
          aspectRatio?: string | null
          colorSpace?: string | null
          createdAt?: string
          format?: string | null
          id?: string
          length?: string | null
          notes?: string | null
          projectId?: string
          resolution?: string | null
          sortOrder?: number
          soundSpecs?: string | null
          title?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Deliverable_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Document: {
        Row: {
          content: string
          createdAt: string
          createdBy: string
          id: string
          projectId: string
          title: string
          type: Database["public"]["Enums"]["DocumentType"]
          updatedAt: string
          version: number
        }
        Insert: {
          content: string
          createdAt?: string
          createdBy: string
          id?: string
          projectId: string
          title: string
          type: Database["public"]["Enums"]["DocumentType"]
          updatedAt?: string
          version?: number
        }
        Update: {
          content?: string
          createdAt?: string
          createdBy?: string
          id?: string
          projectId?: string
          title?: string
          type?: Database["public"]["Enums"]["DocumentType"]
          updatedAt?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "Document_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Document_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Entity: {
        Row: {
          createdAt: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          projectId: string
          type: Database["public"]["Enums"]["EntityType"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          projectId: string
          type: Database["public"]["Enums"]["EntityType"]
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          projectId?: string
          type?: Database["public"]["Enums"]["EntityType"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Entity_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      EntityAttachment: {
        Row: {
          attachedToId: string
          attachedToType: string
          caption: string | null
          createdAt: string
          height: number | null
          id: string
          mimeType: string | null
          projectId: string
          sizeBytes: number | null
          storagePath: string
          updatedAt: string
          uploadedAt: string
          uploadedById: string
          width: number | null
        }
        Insert: {
          attachedToId: string
          attachedToType: string
          caption?: string | null
          createdAt?: string
          height?: number | null
          id?: string
          mimeType?: string | null
          projectId: string
          sizeBytes?: number | null
          storagePath: string
          updatedAt?: string
          uploadedAt?: string
          uploadedById: string
          width?: number | null
        }
        Update: {
          attachedToId?: string
          attachedToType?: string
          caption?: string | null
          createdAt?: string
          height?: number | null
          id?: string
          mimeType?: string | null
          projectId?: string
          sizeBytes?: number | null
          storagePath?: string
          updatedAt?: string
          uploadedAt?: string
          uploadedById?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "EntityAttachment_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EntityAttachment_uploadedById_fkey"
            columns: ["uploadedById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Expense: {
        Row: {
          amount: number
          budgetId: string
          createdAt: string
          createdBy: string
          date: string
          id: string
          lineId: string
          notes: string | null
          receiptUrl: string | null
          source: Database["public"]["Enums"]["ExpenseSource"]
          timecardId: string | null
          unit: Database["public"]["Enums"]["BudgetUnit"] | null
          unitRate: number | null
          units: number | null
          updatedAt: string
          vendor: string | null
        }
        Insert: {
          amount: number
          budgetId: string
          createdAt?: string
          createdBy: string
          date: string
          id: string
          lineId: string
          notes?: string | null
          receiptUrl?: string | null
          source: Database["public"]["Enums"]["ExpenseSource"]
          timecardId?: string | null
          unit?: Database["public"]["Enums"]["BudgetUnit"] | null
          unitRate?: number | null
          units?: number | null
          updatedAt?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          budgetId?: string
          createdAt?: string
          createdBy?: string
          date?: string
          id?: string
          lineId?: string
          notes?: string | null
          receiptUrl?: string | null
          source?: Database["public"]["Enums"]["ExpenseSource"]
          timecardId?: string | null
          unit?: Database["public"]["Enums"]["BudgetUnit"] | null
          unitRate?: number | null
          units?: number | null
          updatedAt?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Expense_budgetId_fkey"
            columns: ["budgetId"]
            isOneToOne: false
            referencedRelation: "Budget"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_lineId_fkey"
            columns: ["lineId"]
            isOneToOne: false
            referencedRelation: "BudgetLine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Expense_timecardId_fkey"
            columns: ["timecardId"]
            isOneToOne: false
            referencedRelation: "CrewTimecard"
            referencedColumns: ["id"]
          },
        ]
      }
      Folder: {
        Row: {
          createdAt: string
          id: string
          name: string
          projectId: string
        }
        Insert: {
          createdAt?: string
          id?: string
          name: string
          projectId: string
        }
        Update: {
          createdAt?: string
          id?: string
          name?: string
          projectId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Folder_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      InventoryItem: {
        Row: {
          assigneeId: string | null
          createdAt: string
          department: string | null
          description: string | null
          id: string
          importSource: Database["public"]["Enums"]["ImportSource"]
          name: string
          notes: string | null
          projectId: string
          quantity: number
          sortOrder: number
          source: string | null
          status: Database["public"]["Enums"]["InventoryItemStatus"]
          updatedAt: string
        }
        Insert: {
          assigneeId?: string | null
          createdAt?: string
          department?: string | null
          description?: string | null
          id?: string
          importSource?: Database["public"]["Enums"]["ImportSource"]
          name: string
          notes?: string | null
          projectId: string
          quantity?: number
          sortOrder?: number
          source?: string | null
          status?: Database["public"]["Enums"]["InventoryItemStatus"]
          updatedAt?: string
        }
        Update: {
          assigneeId?: string | null
          createdAt?: string
          department?: string | null
          description?: string | null
          id?: string
          importSource?: Database["public"]["Enums"]["ImportSource"]
          name?: string
          notes?: string | null
          projectId?: string
          quantity?: number
          sortOrder?: number
          source?: string | null
          status?: Database["public"]["Enums"]["InventoryItemStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "InventoryItem_assigneeId_fkey"
            columns: ["assigneeId"]
            isOneToOne: false
            referencedRelation: "ProjectMember"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "InventoryItem_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Location: {
        Row: {
          address: string | null
          approved: boolean
          createdAt: string
          description: string | null
          entityId: string | null
          id: string
          keyContact: string | null
          name: string
          notes: string | null
          projectId: string
          sceneTab: string | null
          shootDates: string | null
          sortOrder: number
          status: Database["public"]["Enums"]["LocationStatus"]
          updatedAt: string
          webLink: string | null
        }
        Insert: {
          address?: string | null
          approved?: boolean
          createdAt?: string
          description?: string | null
          entityId?: string | null
          id?: string
          keyContact?: string | null
          name: string
          notes?: string | null
          projectId: string
          sceneTab?: string | null
          shootDates?: string | null
          sortOrder?: number
          status?: Database["public"]["Enums"]["LocationStatus"]
          updatedAt?: string
          webLink?: string | null
        }
        Update: {
          address?: string | null
          approved?: boolean
          createdAt?: string
          description?: string | null
          entityId?: string | null
          id?: string
          keyContact?: string | null
          name?: string
          notes?: string | null
          projectId?: string
          sceneTab?: string | null
          shootDates?: string | null
          sortOrder?: number
          status?: Database["public"]["Enums"]["LocationStatus"]
          updatedAt?: string
          webLink?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Location_entityId_fkey"
            columns: ["entityId"]
            isOneToOne: false
            referencedRelation: "Entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Location_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Milestone: {
        Row: {
          createdAt: string
          date: string
          id: string
          mentions: string[]
          notes: string | null
          projectId: string
          status: Database["public"]["Enums"]["MilestoneStatus"]
          title: string
        }
        Insert: {
          createdAt?: string
          date: string
          id?: string
          mentions?: string[]
          notes?: string | null
          projectId: string
          status?: Database["public"]["Enums"]["MilestoneStatus"]
          title: string
        }
        Update: {
          createdAt?: string
          date?: string
          id?: string
          mentions?: string[]
          notes?: string | null
          projectId?: string
          status?: Database["public"]["Enums"]["MilestoneStatus"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "Milestone_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      MilestonePerson: {
        Row: {
          id: string
          milestoneId: string
          userId: string
        }
        Insert: {
          id?: string
          milestoneId: string
          userId: string
        }
        Update: {
          id?: string
          milestoneId?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "MilestonePerson_milestoneId_fkey"
            columns: ["milestoneId"]
            isOneToOne: false
            referencedRelation: "Milestone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MilestonePerson_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      MoodboardRef: {
        Row: {
          cat: Database["public"]["Enums"]["MoodCategory"]
          createdAt: string
          gradient: string | null
          id: string
          imageUrl: string | null
          note: string | null
          projectId: string
          sortOrder: number
          tabId: string | null
          title: string
        }
        Insert: {
          cat: Database["public"]["Enums"]["MoodCategory"]
          createdAt?: string
          gradient?: string | null
          id?: string
          imageUrl?: string | null
          note?: string | null
          projectId: string
          sortOrder?: number
          tabId?: string | null
          title: string
        }
        Update: {
          cat?: Database["public"]["Enums"]["MoodCategory"]
          createdAt?: string
          gradient?: string | null
          id?: string
          imageUrl?: string | null
          note?: string | null
          projectId?: string
          sortOrder?: number
          tabId?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "MoodboardRef_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      MoodboardTab: {
        Row: {
          createdAt: string
          id: string
          name: string
          projectId: string
          sortOrder: number
        }
        Insert: {
          createdAt?: string
          id?: string
          name: string
          projectId: string
          sortOrder?: number
        }
        Update: {
          createdAt?: string
          id?: string
          name?: string
          projectId?: string
          sortOrder?: number
        }
        Relationships: [
          {
            foreignKeyName: "MoodboardTab_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          actorId: string
          contextLabel: string
          createdAt: string
          excerpt: string
          id: string
          projectId: string
          readAt: string | null
          sourceId: string
          sourceType: string
          userId: string
        }
        Insert: {
          actorId: string
          contextLabel: string
          createdAt?: string
          excerpt: string
          id?: string
          projectId: string
          readAt?: string | null
          sourceId: string
          sourceType: string
          userId: string
        }
        Update: {
          actorId?: string
          contextLabel?: string
          createdAt?: string
          excerpt?: string
          id?: string
          projectId?: string
          readAt?: string | null
          sourceId?: string
          sourceType?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Notification_actorId_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notification_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notification_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Project: {
        Row: {
          aspectRatio: string | null
          client: string | null
          color: string | null
          createdAt: string
          id: string
          is_demo: boolean
          name: string
          status: Database["public"]["Enums"]["ProjectStatus"]
          teamId: string
          type: string | null
          updatedAt: string
        }
        Insert: {
          aspectRatio?: string | null
          client?: string | null
          color?: string | null
          createdAt?: string
          id?: string
          is_demo?: boolean
          name: string
          status: Database["public"]["Enums"]["ProjectStatus"]
          teamId: string
          type?: string | null
          updatedAt?: string
        }
        Update: {
          aspectRatio?: string | null
          client?: string | null
          color?: string | null
          createdAt?: string
          id?: string
          is_demo?: boolean
          name?: string
          status?: Database["public"]["Enums"]["ProjectStatus"]
          teamId?: string
          type?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Project_teamId_fkey"
            columns: ["teamId"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["id"]
          },
        ]
      }
      ProjectMember: {
        Row: {
          canEdit: boolean
          createdAt: string
          defaultLineItemId: string | null
          department: string | null
          id: string
          notes: string | null
          projectId: string
          role: Database["public"]["Enums"]["Role"]
          skills: string[]
          userId: string
        }
        Insert: {
          canEdit?: boolean
          createdAt?: string
          defaultLineItemId?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          projectId: string
          role: Database["public"]["Enums"]["Role"]
          skills?: string[]
          userId: string
        }
        Update: {
          canEdit?: boolean
          createdAt?: string
          defaultLineItemId?: string | null
          department?: string | null
          id?: string
          notes?: string | null
          projectId?: string
          role?: Database["public"]["Enums"]["Role"]
          skills?: string[]
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ProjectMember_defaultLineItemId_fkey"
            columns: ["defaultLineItemId"]
            isOneToOne: false
            referencedRelation: "BudgetLine"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProjectMember_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ProjectMember_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      PropSourced: {
        Row: {
          createdAt: string
          entityId: string | null
          id: string
          isHero: boolean
          projectId: string
          status: Database["public"]["Enums"]["PropStatus"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          entityId?: string | null
          id?: string
          isHero?: boolean
          projectId: string
          status?: Database["public"]["Enums"]["PropStatus"]
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          entityId?: string | null
          id?: string
          isHero?: boolean
          projectId?: string
          status?: Database["public"]["Enums"]["PropStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "PropSourced_entityId_fkey"
            columns: ["entityId"]
            isOneToOne: false
            referencedRelation: "Entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "PropSourced_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      PushSubscription: {
        Row: {
          auth: string
          createdAt: string
          endpoint: string
          id: string
          p256dh: string
          userAgent: string | null
          userId: string
        }
        Insert: {
          auth: string
          createdAt?: string
          endpoint: string
          id?: string
          p256dh: string
          userAgent?: string | null
          userId: string
        }
        Update: {
          auth?: string
          createdAt?: string
          endpoint?: string
          id?: string
          p256dh?: string
          userAgent?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "PushSubscription_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Resource: {
        Row: {
          createdAt: string
          createdBy: string
          folderId: string | null
          id: string
          projectId: string | null
          teamId: string
          title: string
          type: Database["public"]["Enums"]["ResourceType"]
          url: string
        }
        Insert: {
          createdAt?: string
          createdBy: string
          folderId?: string | null
          id?: string
          projectId?: string | null
          teamId: string
          title: string
          type: Database["public"]["Enums"]["ResourceType"]
          url: string
        }
        Update: {
          createdAt?: string
          createdBy?: string
          folderId?: string | null
          id?: string
          projectId?: string | null
          teamId?: string
          title?: string
          type?: Database["public"]["Enums"]["ResourceType"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "Resource_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Resource_folderId_fkey"
            columns: ["folderId"]
            isOneToOne: false
            referencedRelation: "Folder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Resource_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Resource_teamId_fkey"
            columns: ["teamId"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["id"]
          },
        ]
      }
      Scene: {
        Row: {
          createdAt: string
          description: string | null
          id: string
          projectId: string
          sceneNumber: string
          sortOrder: number
          title: string | null
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          description?: string | null
          id?: string
          projectId: string
          sceneNumber: string
          sortOrder: number
          title?: string | null
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          description?: string | null
          id?: string
          projectId?: string
          sceneNumber?: string
          sortOrder?: number
          title?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Scene_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      ScheduleBlock: {
        Row: {
          createdAt: string
          crewMemberIds: string[]
          customLabel: string | null
          description: string
          endTime: string | null
          id: string
          kind: Database["public"]["Enums"]["ScheduleBlockKind"]
          locationId: string | null
          projectId: string
          sceneIds: string[]
          shootDayId: string
          sortOrder: number
          startTime: string
          talentIds: string[]
          track: Database["public"]["Enums"]["ScheduleBlockTrack"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          crewMemberIds?: string[]
          customLabel?: string | null
          description: string
          endTime?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ScheduleBlockKind"]
          locationId?: string | null
          projectId: string
          sceneIds?: string[]
          shootDayId: string
          sortOrder?: number
          startTime: string
          talentIds?: string[]
          track?: Database["public"]["Enums"]["ScheduleBlockTrack"]
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          crewMemberIds?: string[]
          customLabel?: string | null
          description?: string
          endTime?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ScheduleBlockKind"]
          locationId?: string | null
          projectId?: string
          sceneIds?: string[]
          shootDayId?: string
          sortOrder?: number
          startTime?: string
          talentIds?: string[]
          track?: Database["public"]["Enums"]["ScheduleBlockTrack"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ScheduleBlock_locationId_fkey"
            columns: ["locationId"]
            isOneToOne: false
            referencedRelation: "Location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ScheduleBlock_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ScheduleBlock_shootDayId_fkey"
            columns: ["shootDayId"]
            isOneToOne: false
            referencedRelation: "ShootDay"
            referencedColumns: ["id"]
          },
        ]
      }
      ShootDay: {
        Row: {
          createdAt: string
          date: string
          id: string
          locationId: string | null
          mentions: string[]
          notes: string | null
          projectId: string
          sortOrder: number
          type: Database["public"]["Enums"]["ShootDayType"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          date: string
          id: string
          locationId?: string | null
          mentions?: string[]
          notes?: string | null
          projectId: string
          sortOrder: number
          type: Database["public"]["Enums"]["ShootDayType"]
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          date?: string
          id?: string
          locationId?: string | null
          mentions?: string[]
          notes?: string | null
          projectId?: string
          sortOrder?: number
          type?: Database["public"]["Enums"]["ShootDayType"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ShootDay_locationId_fkey"
            columns: ["locationId"]
            isOneToOne: false
            referencedRelation: "Location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ShootDay_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Shot: {
        Row: {
          createdAt: string
          description: string | null
          id: string
          imageUrl: string | null
          notes: string | null
          sceneId: string
          shootOrder: number | null
          shotNumber: string
          size: Database["public"]["Enums"]["ShotSize"] | null
          sortOrder: number
          status: Database["public"]["Enums"]["ShotStatus"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          description?: string | null
          id?: string
          imageUrl?: string | null
          notes?: string | null
          sceneId: string
          shootOrder?: number | null
          shotNumber: string
          size?: Database["public"]["Enums"]["ShotSize"] | null
          sortOrder: number
          status?: Database["public"]["Enums"]["ShotStatus"]
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          description?: string | null
          id?: string
          imageUrl?: string | null
          notes?: string | null
          sceneId?: string
          shootOrder?: number | null
          shotNumber?: string
          size?: Database["public"]["Enums"]["ShotSize"] | null
          sortOrder?: number
          status?: Database["public"]["Enums"]["ShotStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Shot_sceneId_fkey"
            columns: ["sceneId"]
            isOneToOne: false
            referencedRelation: "Scene"
            referencedColumns: ["id"]
          },
        ]
      }
      ShotlistVersion: {
        Row: {
          createdAt: string
          id: string
          label: string | null
          projectId: string
          shots: Json
          versionNumber: number
        }
        Insert: {
          createdAt?: string
          id?: string
          label?: string | null
          projectId: string
          shots: Json
          versionNumber: number
        }
        Update: {
          createdAt?: string
          id?: string
          label?: string | null
          projectId?: string
          shots?: Json
          versionNumber?: number
        }
        Relationships: [
          {
            foreignKeyName: "ShotlistVersion_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      Talent: {
        Row: {
          agency: string | null
          contact: string | null
          createdAt: string
          dietaryRestrictions: string | null
          email: string | null
          id: string
          imageUrl: string | null
          name: string
          notes: string | null
          phone: string | null
          projectId: string
          repEmail: string | null
          repName: string | null
          repPhone: string | null
          role: string | null
          shootDates: Json | null
          updatedAt: string
        }
        Insert: {
          agency?: string | null
          contact?: string | null
          createdAt?: string
          dietaryRestrictions?: string | null
          email?: string | null
          id: string
          imageUrl?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          projectId: string
          repEmail?: string | null
          repName?: string | null
          repPhone?: string | null
          role?: string | null
          shootDates?: Json | null
          updatedAt?: string
        }
        Update: {
          agency?: string | null
          contact?: string | null
          createdAt?: string
          dietaryRestrictions?: string | null
          email?: string | null
          id?: string
          imageUrl?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          projectId?: string
          repEmail?: string | null
          repName?: string | null
          repPhone?: string | null
          role?: string | null
          shootDates?: Json | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Talent_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      TalentAssignment: {
        Row: {
          createdAt: string
          entityId: string
          id: string
          talentId: string
        }
        Insert: {
          createdAt?: string
          entityId: string
          id: string
          talentId: string
        }
        Update: {
          createdAt?: string
          entityId?: string
          id?: string
          talentId?: string
        }
        Relationships: [
          {
            foreignKeyName: "TalentAssignment_entityId_fkey"
            columns: ["entityId"]
            isOneToOne: false
            referencedRelation: "Entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TalentAssignment_talentId_fkey"
            columns: ["talentId"]
            isOneToOne: false
            referencedRelation: "Talent"
            referencedColumns: ["id"]
          },
        ]
      }
      Team: {
        Row: {
          createdAt: string
          id: string
          name: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id?: string
          name: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          id?: string
          name?: string
          updatedAt?: string
        }
        Relationships: []
      }
      TeamMember: {
        Row: {
          createdAt: string
          id: string
          role: Database["public"]["Enums"]["Role"]
          teamId: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id?: string
          role: Database["public"]["Enums"]["Role"]
          teamId: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          role?: Database["public"]["Enums"]["Role"]
          teamId?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "TeamMember_teamId_fkey"
            columns: ["teamId"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TeamMember_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Thread: {
        Row: {
          attachedToId: string
          attachedToType: string
          createdAt: string
          createdBy: string
          id: string
          projectId: string
          resolvedAt: string | null
          resolvedBy: string | null
          updatedAt: string
        }
        Insert: {
          attachedToId: string
          attachedToType: string
          createdAt?: string
          createdBy: string
          id?: string
          projectId: string
          resolvedAt?: string | null
          resolvedBy?: string | null
          updatedAt?: string
        }
        Update: {
          attachedToId?: string
          attachedToType?: string
          createdAt?: string
          createdBy?: string
          id?: string
          projectId?: string
          resolvedAt?: string | null
          resolvedBy?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Thread_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Thread_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Thread_resolvedBy_fkey"
            columns: ["resolvedBy"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      ThreadMessage: {
        Row: {
          content: string
          createdAt: string
          createdBy: string
          id: string
          mentions: string[]
          threadId: string
        }
        Insert: {
          content: string
          createdAt?: string
          createdBy: string
          id?: string
          mentions?: string[]
          threadId: string
        }
        Update: {
          content?: string
          createdAt?: string
          createdBy?: string
          id?: string
          mentions?: string[]
          threadId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ThreadMessage_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ThreadMessage_threadId_fkey"
            columns: ["threadId"]
            isOneToOne: false
            referencedRelation: "Thread"
            referencedColumns: ["id"]
          },
        ]
      }
      ThreadRead: {
        Row: {
          id: string
          lastReadAt: string
          threadId: string
          userId: string
        }
        Insert: {
          id?: string
          lastReadAt?: string
          threadId: string
          userId: string
        }
        Update: {
          id?: string
          lastReadAt?: string
          threadId?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ThreadRead_threadId_fkey"
            columns: ["threadId"]
            isOneToOne: false
            referencedRelation: "Thread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ThreadRead_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          authId: string | null
          avatarUrl: string | null
          createdAt: string
          email: string
          id: string
          name: string
          phone: string | null
          updatedAt: string
        }
        Insert: {
          authId?: string | null
          avatarUrl?: string | null
          createdAt?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updatedAt?: string
        }
        Update: {
          authId?: string | null
          avatarUrl?: string | null
          createdAt?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      TeamProjectFolder: {
        Row: {
          archived: boolean
          color: string | null
          createdAt: string
          id: string
          name: string
          sortOrder: number
          teamId: string
          updatedAt: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          createdAt?: string
          id?: string
          name?: string
          sortOrder?: number
          teamId: string
          updatedAt?: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          createdAt?: string
          id?: string
          name?: string
          sortOrder?: number
          teamId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "TeamProjectFolder_teamId_fkey"
            columns: ["teamId"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["id"]
          },
        ]
      }
      TeamProjectPlacement: {
        Row: {
          createdAt: string
          folderId: string | null
          id: string
          projectId: string
          sortOrder: number
          teamId: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          folderId?: string | null
          id?: string
          projectId: string
          sortOrder?: number
          teamId: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          folderId?: string | null
          id?: string
          projectId?: string
          sortOrder?: number
          teamId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "TeamProjectPlacement_folderId_fkey"
            columns: ["folderId"]
            isOneToOne: false
            referencedRelation: "TeamProjectFolder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TeamProjectPlacement_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TeamProjectPlacement_teamId_fkey"
            columns: ["teamId"]
            isOneToOne: false
            referencedRelation: "Team"
            referencedColumns: ["id"]
          },
        ]
      }
      WardrobeSourced: {
        Row: {
          createdAt: string
          entityId: string | null
          id: string
          projectId: string
          status: Database["public"]["Enums"]["WardrobeStatus"]
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          entityId?: string | null
          id?: string
          projectId: string
          status?: Database["public"]["Enums"]["WardrobeStatus"]
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          entityId?: string | null
          id?: string
          projectId?: string
          status?: Database["public"]["Enums"]["WardrobeStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "WardrobeSourced_entityId_fkey"
            columns: ["entityId"]
            isOneToOne: false
            referencedRelation: "Entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "WardrobeSourced_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
      WorkflowEdge: {
        Row: {
          createdAt: string
          format: string | null
          handoff: string | null
          id: string
          inputFormat: string | null
          notes: string | null
          outputFormat: string | null
          projectId: string
          sourceId: string
          targetId: string
        }
        Insert: {
          createdAt?: string
          format?: string | null
          handoff?: string | null
          id: string
          inputFormat?: string | null
          notes?: string | null
          outputFormat?: string | null
          projectId: string
          sourceId: string
          targetId: string
        }
        Update: {
          createdAt?: string
          format?: string | null
          handoff?: string | null
          id?: string
          inputFormat?: string | null
          notes?: string | null
          outputFormat?: string | null
          projectId?: string
          sourceId?: string
          targetId?: string
        }
        Relationships: [
          {
            foreignKeyName: "WorkflowEdge_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "WorkflowEdge_sourceId_fkey"
            columns: ["sourceId"]
            isOneToOne: false
            referencedRelation: "WorkflowNode"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "WorkflowEdge_targetId_fkey"
            columns: ["targetId"]
            isOneToOne: false
            referencedRelation: "WorkflowNode"
            referencedColumns: ["id"]
          },
        ]
      }
      WorkflowNode: {
        Row: {
          assigneeId: string | null
          createdAt: string
          id: string
          label: string
          notes: string | null
          projectId: string
          software: string | null
          sortOrder: number
          type: string
          updatedAt: string
        }
        Insert: {
          assigneeId?: string | null
          createdAt?: string
          id: string
          label: string
          notes?: string | null
          projectId: string
          software?: string | null
          sortOrder?: number
          type: string
          updatedAt?: string
        }
        Update: {
          assigneeId?: string | null
          createdAt?: string
          id?: string
          label?: string
          notes?: string | null
          projectId?: string
          software?: string | null
          sortOrder?: number
          type?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "WorkflowNode_assigneeId_fkey"
            columns: ["assigneeId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "WorkflowNode_projectId_fkey"
            columns: ["projectId"]
            isOneToOne: false
            referencedRelation: "Project"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_call_sheet: {
        Args: { p_auth_id: string; p_project_id: string }
        Returns: boolean
      }
      current_user_id: { Args: never; Returns: string }
      has_high_trust_write: {
        Args: { p_auth_id: string; p_project_id: string }
        Returns: boolean
      }
      has_producer_access: {
        Args: { p_auth_id: string; p_project_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { p_auth_id: string; p_project_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { p_auth_id: string; p_team_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ActionItemStatus: "open" | "in_progress" | "done"
      BudgetAccountSection: "ATL" | "BTL"
      BudgetUnit: "DAY" | "WEEK" | "HOUR" | "FLAT" | "UNIT"
      BudgetVersionKind: "estimate" | "working" | "committed" | "other"
      BudgetVersionState: "draft" | "locked"
      CallSheetDeliveryChannel: "email" | "sms"
      CallSheetDeliveryProvider: "resend" | "twilio" | "stub"
      CallSheetDeliveryStatus:
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "bounced"
        | "failed"
      CallSheetRecipientKind: "talent" | "crew" | "client" | "freeform"
      CallSheetStatus: "draft" | "sent"
      DocumentType: "script" | "scene" | "board" | "lore" | "note"
      EntityType: "character" | "location" | "prop" | "wardrobe" | "hmu"
      ExpenseSource: "timecard" | "manual"
      ImportSource: "manual" | "pdf" | "excel"
      InventoryItemStatus:
        | "needed"
        | "ordered"
        | "arrived"
        | "packed"
        | "returned"
      LocationStatus:
        | "unscouted"
        | "scouting"
        | "in_talks"
        | "confirmed"
        | "passed"
      MarkupTarget: "grandTotal" | "accountSubtotal"
      MilestoneStatus: "upcoming" | "in_progress" | "completed"
      MoodCategory: "tone" | "visual" | "product" | "music"
      ProjectStatus:
        | "development"
        | "pre_production"
        | "production"
        | "post_production"
        | "archived"
      PropStatus: "needed" | "sourced" | "ready"
      RateUnit: "day" | "hour"
      ResourceType: "link" | "file" | "image" | "video" | "document"
      Role:
        | "director"
        | "producer"
        | "coordinator"
        | "writer"
        | "crew"
        | "partner"
      ScheduleBlockKind:
        | "work"
        | "load_in"
        | "talent_call"
        | "lunch"
        | "wrap"
        | "tail_lights"
        | "meal_break"
        | "custom"
      ScheduleBlockTrack: "main" | "secondary" | "tertiary"
      ShootDayType: "pre" | "prod" | "post"
      ShotSize:
        | "extreme_wide"
        | "wide"
        | "full"
        | "medium"
        | "medium_close_up"
        | "close_up"
        | "extreme_close_up"
        | "insert"
        | "cowboy"
        | "two_shot"
        | "over_the_shoulder"
      ShotStatus: "planned" | "in_progress" | "completed" | "omitted"
      TimecardStatus: "draft" | "submitted" | "approved" | "reopened"
      WardrobeStatus: "needed" | "sourced" | "fitted" | "ready"
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
      ActionItemStatus: ["open", "in_progress", "done"],
      BudgetAccountSection: ["ATL", "BTL"],
      BudgetUnit: ["DAY", "WEEK", "HOUR", "FLAT", "UNIT"],
      BudgetVersionKind: ["estimate", "working", "committed", "other"],
      BudgetVersionState: ["draft", "locked"],
      CallSheetDeliveryChannel: ["email", "sms"],
      CallSheetDeliveryProvider: ["resend", "twilio", "stub"],
      CallSheetDeliveryStatus: [
        "queued",
        "sent",
        "delivered",
        "opened",
        "bounced",
        "failed",
      ],
      CallSheetRecipientKind: ["talent", "crew", "client", "freeform"],
      CallSheetStatus: ["draft", "sent"],
      DocumentType: ["script", "scene", "board", "lore", "note"],
      EntityType: ["character", "location", "prop", "wardrobe", "hmu"],
      ExpenseSource: ["timecard", "manual"],
      ImportSource: ["manual", "pdf", "excel"],
      InventoryItemStatus: [
        "needed",
        "ordered",
        "arrived",
        "packed",
        "returned",
      ],
      LocationStatus: [
        "unscouted",
        "scouting",
        "in_talks",
        "confirmed",
        "passed",
      ],
      MarkupTarget: ["grandTotal", "accountSubtotal"],
      MilestoneStatus: ["upcoming", "in_progress", "completed"],
      MoodCategory: ["tone", "visual", "product", "music"],
      ProjectStatus: [
        "development",
        "pre_production",
        "production",
        "post_production",
        "archived",
      ],
      PropStatus: ["needed", "sourced", "ready"],
      RateUnit: ["day", "hour"],
      ResourceType: ["link", "file", "image", "video", "document"],
      Role: [
        "director",
        "producer",
        "coordinator",
        "writer",
        "crew",
        "partner",
      ],
      ScheduleBlockKind: [
        "work",
        "load_in",
        "talent_call",
        "lunch",
        "wrap",
        "tail_lights",
        "meal_break",
        "custom",
      ],
      ScheduleBlockTrack: ["main", "secondary", "tertiary"],
      ShootDayType: ["pre", "prod", "post"],
      ShotSize: [
        "extreme_wide",
        "wide",
        "full",
        "medium",
        "medium_close_up",
        "close_up",
        "extreme_close_up",
        "insert",
        "cowboy",
        "two_shot",
        "over_the_shoulder",
      ],
      ShotStatus: ["planned", "in_progress", "completed", "omitted"],
      TimecardStatus: ["draft", "submitted", "approved", "reopened"],
      WardrobeStatus: ["needed", "sourced", "fitted", "ready"],
    },
  },
} as const
