// ============================================================================
// ClassSync Soft UI Task Card Component
// File: src/components/tasks/TaskCard.tsx
// Description: Reusable, pill-shaped task card component featuring circular
//              checkbox toggle, course tags, relative deadline badges,
//              and strict ownership action guards (Edit/Delete).
// ============================================================================

import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import {
  Check,
  Clock,
  Pencil,
  Trash2,
  Lock,
  Users,
  AlertCircle,
  FileText,
  HelpCircle,
  FolderGit2,
  Presentation,
  Megaphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import {
  formatDeadlineRelative,
  getTaskTypeMetadata,
  type AcademicTask,
  type TaskType,
} from '@/lib/tasks/taskUtils';
import type { AcademicTaskRow } from '@/store/useAppStore';

export interface TaskCardProps {
  task: AcademicTaskRow;
  isCompleted?: boolean;
  onToggleComplete: (taskId: string) => void;
  onEdit?: (task: AcademicTaskRow) => void;
  onDelete?: (taskId: string) => void;
  currentUserId?: string | null;
  isSectionAdmin?: boolean;
}

export function TaskCard({
  task,
  isCompleted = false,
  onToggleComplete,
  onEdit,
  onDelete,
  currentUserId,
  isSectionAdmin = false,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // CRITICAL DEFICIENCY 2 FIX: Conditional Action Guards
  // Only the creator can edit/delete personal tasks.
  // Only Genesis CR or Co-Admin can edit/delete cohort-wide tasks.
  const canManage =
    (task.is_personal && task.created_by === currentUserId) ||
    (!task.is_personal && isSectionAdmin);

  const typeMeta = getTaskTypeMetadata(task.task_type);
  const deadline = formatDeadlineRelative(task.due_datetime);

  const handleDeletePress = () => {
    if (!onDelete) return;

    Alert.alert(
      'Delete Academic Task',
      `Are you sure you want to delete "${task.title}"?${
        !task.is_personal
          ? ' This will delete the cohort task for all section members.'
          : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(task.id),
        },
      ]
    );
  };

  const renderTypeIcon = (type: string, size = 12, color?: string) => {
    const iconColor = color || typeMeta.badgeText;
    switch (type.toLowerCase()) {
      case 'quiz':
        return <HelpCircle size={size} color={iconColor} />;
      case 'project':
        return <FolderGit2 size={size} color={iconColor} />;
      case 'presentation':
        return <Presentation size={size} color={iconColor} />;
      case 'administrative':
        return <Megaphone size={size} color={iconColor} />;
      case 'assignment':
      default:
        return <FileText size={size} color={iconColor} />;
    }
  };

  return (
    <View
      className={`rounded-3xl p-4 mb-3 border transition-all ${
        isCompleted
          ? 'bg-neutral-50/80 border-neutral-200/60 opacity-75'
          : deadline.isOverdue
          ? 'bg-white border-rose-200/80 shadow-2xs'
          : 'bg-white border-neutral-100/90 shadow-2xs'
      }`}
    >
      {/* Top Meta Row: Task Type Chip + Course Tag + Cohort Scope */}
      <View className="flex-row items-center justify-between mb-2.5">
        <View className="flex-row items-center flex-wrap gap-1.5 flex-1 pr-2">
          {/* Task Type Pill */}
          <View
            style={{
              backgroundColor: isCompleted ? '#F1F5F9' : typeMeta.badgeBg,
              borderColor: isCompleted ? '#E2E8F0' : typeMeta.borderColor,
            }}
            className="px-2.5 py-0.5 rounded-full border flex-row items-center"
          >
            {renderTypeIcon(
              task.task_type,
              11,
              isCompleted ? '#64748B' : typeMeta.badgeText
            )}
            <Text
              style={{
                color: isCompleted ? '#64748B' : typeMeta.badgeText,
              }}
              className="text-[10px] font-black uppercase tracking-wider ml-1"
            >
              {typeMeta.label}
            </Text>
          </View>

          {/* Course Affiliation Pill */}
          {task.course ? (
            <View className="px-2.5 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/60 flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{
                  backgroundColor: task.course.color_hex || '#3B82F6',
                }}
              />
              <Text
                className="text-[10px] font-bold text-neutral-700"
                numberOfLines={1}
              >
                {task.course.code || task.course.name}
              </Text>
            </View>
          ) : (
            <View className="px-2.5 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/60 flex-row items-center">
              <Text className="text-[10px] font-bold text-neutral-600">
                General
              </Text>
            </View>
          )}

          {/* Scope Badge (Cohort vs Personal) */}
          {!task.is_personal ? (
            <View className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 flex-row items-center">
              <Users size={10} color="#2563EB" />
              <Text className="text-[9px] font-black text-blue-700 uppercase tracking-wider ml-1">
                Cohort
              </Text>
            </View>
          ) : (
            <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/50 flex-row items-center">
              <Lock size={10} color="#64748B" />
              <Text className="text-[9px] font-bold text-neutral-500 ml-1">
                Personal
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons (Strictly Guarded) */}
        {canManage && (
          <View className="flex-row items-center space-x-1">
            {onEdit && (
              <Pressable
                onPress={() => onEdit(task)}
                hitSlop={8}
                className="w-7 h-7 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200"
              >
                <Pencil size={12} color="#475569" />
              </Pressable>
            )}

            {onDelete && (
              <Pressable
                onPress={handleDeletePress}
                hitSlop={8}
                className="w-7 h-7 rounded-full bg-rose-50 items-center justify-center active:bg-rose-100 ml-1"
              >
                <Trash2 size={12} color="#E11D48" />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Main Task Title & Checkbox Row */}
      <View className="flex-row items-start justify-between mt-1">
        {/* Title and details */}
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          className="flex-1 pr-3"
        >
          <Text
            className={`text-sm font-bold leading-snug ${
              isCompleted
                ? 'line-through text-neutral-400 font-medium'
                : 'text-neutral-900'
            }`}
          >
            {task.title}
          </Text>

          {/* Due date relative badge */}
          <View className="flex-row items-center mt-2">
            <View
              className={`px-2 py-0.5 rounded-full border flex-row items-center ${
                isCompleted
                  ? 'bg-neutral-100 border-neutral-200'
                  : deadline.isOverdue
                  ? 'bg-rose-50 border-rose-200'
                  : deadline.isUrgent
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <Clock
                size={10}
                color={
                  isCompleted
                    ? '#94A3B8'
                    : deadline.isOverdue
                    ? '#E11D48'
                    : deadline.isUrgent
                    ? '#D97706'
                    : '#2563EB'
                }
              />
              <Text
                className={`text-[10px] font-bold ml-1 ${
                  isCompleted
                    ? 'text-neutral-500'
                    : deadline.isOverdue
                    ? 'text-rose-700'
                    : deadline.isUrgent
                    ? 'text-amber-700'
                    : 'text-blue-700'
                }`}
              >
                {isCompleted ? 'Completed' : deadline.text}
              </Text>
            </View>

            {task.description && (
              <Pressable
                onPress={() => setIsExpanded(!isExpanded)}
                className="flex-row items-center ml-2 py-0.5 px-1.5"
              >
                <Text className="text-[10px] font-semibold text-neutral-500">
                  {isExpanded ? 'Hide details' : 'Details'}
                </Text>
                {isExpanded ? (
                  <ChevronUp size={10} color="#64748B" className="ml-0.5" />
                ) : (
                  <ChevronDown size={10} color="#64748B" className="ml-0.5" />
                )}
              </Pressable>
            )}
          </View>
        </Pressable>

        {/* Checkbox (Stitch Squircle) */}
        <Pressable
          onPress={() => onToggleComplete(task.id)}
          accessibilityRole="checkbox"
          aria-label="Toggle task completion"
          aria-checked={isCompleted}
          hitSlop={12}
          className={`w-6 h-6 rounded-lg items-center justify-center transition-all ${
            isCompleted
              ? 'bg-[#FACC15] border-2 border-[#EAB308] shadow-2xs'
              : 'bg-white border-2 border-neutral-300 active:border-neutral-500'
          }`}
        >
          {isCompleted && <Check size={14} color="#18181B" strokeWidth={3} />}
        </Pressable>
      </View>

      {/* Expandable Description Details */}
      {isExpanded && task.description && (
        <View className="mt-3 pt-3 border-t border-neutral-100">
          <Text className="text-xs text-neutral-700 leading-relaxed font-normal">
            {task.description}
          </Text>
        </View>
      )}
    </View>
  );
}
