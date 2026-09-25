// ============================================================================
// ClassSync Premium Task Card Component
// File: src/components/tasks/TaskCard.tsx
// Description: Modern squircle task card generated via Stitch UI overhaul.
//              Features circular completion checkbox, left leading stripe,
//              monospace course tags, relative deadline badges, and strict
//              ownership guards.
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
  FileText,
  HelpCircle,
  FolderGit2,
  Presentation,
  Megaphone,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react-native';
import {
  formatDeadlineRelative,
  getTaskTypeMetadata,
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

  // Ownership Action Guards
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

  const renderTypeIcon = (type: string, size = 12, color = '#18181B') => {
    switch (type.toLowerCase()) {
      case 'quiz':
        return <HelpCircle size={size} color={color} />;
      case 'project':
        return <FolderGit2 size={size} color={color} />;
      case 'presentation':
        return <Presentation size={size} color={color} />;
      case 'administrative':
        return <Megaphone size={size} color={color} />;
      case 'assignment':
      default:
        return <FileText size={size} color={color} />;
    }
  };

  // Color bar indicator: Rose if overdue, Yellow if urgent/due soon, Neutral if upcoming, Emerald if completed
  const stripeColor = isCompleted
    ? '#10B981'
    : deadline.isOverdue
    ? '#E11D48'
    : deadline.isUrgent
    ? '#FACC15'
    : '#A1A1AA';

  return (
    <View
      className={`rounded-2xl p-3.5 mb-2.5 border relative overflow-hidden bg-white shadow-2xs transition-all ${
        isCompleted
          ? 'border-neutral-200/60 bg-neutral-50/60 opacity-80'
          : deadline.isOverdue
          ? 'border-rose-200'
          : deadline.isUrgent
          ? 'border-[#FACC15]/60'
          : 'border-neutral-200/80'
      }`}
    >
      {/* 1. Left Edge Solid Accent Indicator Bar */}
      <View
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: stripeColor }}
      />

      <View className="pl-1.5">
        {/* 2. Top Header Metadata: Tags & Actions */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center flex-wrap gap-1.5 flex-1 pr-2">
            {/* Course Code Tag */}
            {task.course ? (
              <View className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200/80 flex-row items-center">
                <View
                  className="w-1.5 h-1.5 rounded-full mr-1.5"
                  style={{ backgroundColor: task.course.color_hex || '#FACC15' }}
                />
                <Text className="text-[10px] font-black font-mono text-neutral-800">
                  {task.course.code || task.course.name}
                </Text>
              </View>
            ) : (
              <View className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200/80">
                <Text className="text-[10px] font-bold text-neutral-600">General</Text>
              </View>
            )}

            {/* Task Type Pill */}
            <View className="px-2 py-0.5 rounded-full bg-[#FACC15]/20 border border-[#FACC15]/40 flex-row items-center space-x-1">
              {renderTypeIcon(task.task_type, 10, '#18181B')}
              <Text className="text-[10px] font-black text-neutral-900 uppercase ml-1">
                {typeMeta.label}
              </Text>
            </View>

            {/* Scope Badge (Cohort vs Personal) */}
            {!task.is_personal ? (
              <View className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/70 flex-row items-center">
                <Users size={10} color="#2563EB" />
                <Text className="text-[9px] font-black text-blue-700 uppercase tracking-wider ml-1">
                  Cohort
                </Text>
              </View>
            ) : (
              <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/60 flex-row items-center">
                <Lock size={9} color="#71717A" />
                <Text className="text-[9px] font-bold text-neutral-500 ml-1">Personal</Text>
              </View>
            )}
          </View>

          {/* Action Icons (Edit / Delete) */}
          {canManage && (
            <View className="flex-row items-center space-x-1">
              {onEdit && (
                <Pressable
                  onPress={() => onEdit(task)}
                  hitSlop={8}
                  className="w-7 h-7 rounded-lg bg-neutral-100 items-center justify-center active:bg-neutral-200"
                  accessibilityLabel="Edit task"
                >
                  <Pencil size={11} color="#18181B" />
                </Pressable>
              )}

              {onDelete && (
                <Pressable
                  onPress={handleDeletePress}
                  hitSlop={8}
                  className="w-7 h-7 rounded-lg bg-rose-50 items-center justify-center active:bg-rose-100 ml-1"
                  accessibilityLabel="Delete task"
                >
                  <Trash2 size={11} color="#E11D48" />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* 3. Main Row: Checkbox + Title */}
        <View className="flex-row items-start justify-between">
          {/* Circular Checkbox */}
          <Pressable
            onPress={() => onToggleComplete(task.id)}
            hitSlop={10}
            className={`w-6 h-6 rounded-full items-center justify-center mr-2.5 mt-0.5 border-2 transition-all ${
              isCompleted
                ? 'bg-[#FACC15] border-[#FACC15] shadow-2xs'
                : deadline.isOverdue
                ? 'border-rose-400 bg-rose-50 active:bg-rose-100'
                : 'border-neutral-300 bg-white active:border-[#FACC15]'
            }`}
            accessibilityLabel={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && <Check size={13} color="#18181B" strokeWidth={3} />}
          </Pressable>

          {/* Task Title & Details */}
          <Pressable
            onPress={() => setIsExpanded(!isExpanded)}
            className="flex-1 mr-1"
          >
            <Text
              className={`text-sm font-black tracking-tight leading-snug ${
                isCompleted
                  ? 'line-through text-neutral-400 font-medium'
                  : 'text-neutral-900'
              }`}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {task.title}
            </Text>

            {/* Expandable Description */}
            {task.description ? (
              <View className="mt-1">
                {isExpanded ? (
                  <Text className="text-xs text-neutral-600 leading-relaxed font-medium bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/60 mt-1">
                    {task.description}
                  </Text>
                ) : (
                  <Text className="text-[11px] text-neutral-400 truncate font-medium">
                    {task.description}
                  </Text>
                )}
              </View>
            ) : null}
          </Pressable>

          {/* Expand/Collapse Chevron */}
          {task.description ? (
            <Pressable
              onPress={() => setIsExpanded(!isExpanded)}
              hitSlop={8}
              className="p-1"
            >
              {isExpanded ? (
                <ChevronUp size={14} color="#A1A1AA" />
              ) : (
                <ChevronDown size={14} color="#A1A1AA" />
              )}
            </Pressable>
          ) : null}
        </View>

        {/* 4. Footer Row: Relative Deadline Badge */}
        <View className="flex-row items-center justify-between pt-2.5 mt-2 border-t border-neutral-100">
          <View
            className={`px-2.5 py-1 rounded-full border flex-row items-center space-x-1 ${
              isCompleted
                ? 'bg-neutral-100 border-neutral-200'
                : deadline.isOverdue
                ? 'bg-rose-50 border-rose-200'
                : deadline.isUrgent
                ? 'bg-[#FACC15]/20 border-[#FACC15]/50'
                : 'bg-neutral-100 border-neutral-200/80'
            }`}
          >
            {deadline.isOverdue ? (
              <AlertTriangle size={11} color="#E11D48" strokeWidth={2.5} />
            ) : (
              <Clock
                size={11}
                color={
                  isCompleted
                    ? '#A1A1AA'
                    : deadline.isUrgent
                    ? '#18181B'
                    : '#71717A'
                }
              />
            )}
            <Text
              className={`text-[10px] font-black ml-1 ${
                isCompleted
                  ? 'text-neutral-500'
                  : deadline.isOverdue
                  ? 'text-rose-700'
                  : deadline.isUrgent
                  ? 'text-neutral-950'
                  : 'text-neutral-700'
              }`}
            >
              {isCompleted ? 'Completed' : deadline.text}
            </Text>
          </View>

          <Text className="text-[10px] font-semibold text-neutral-400 font-mono">
            {new Date(task.due_datetime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}
