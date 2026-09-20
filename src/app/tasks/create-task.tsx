// ============================================================================
// ClassSync Academic Task Publishing & Edit Modal
// File: src/app/tasks/create-task.tsx
// Description: Presentation modal for creating and updating academic tasks,
//              featuring soft UI inputs, task type chips, course selector,
//              and glassmorphic styling.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  BookOpen,
  FileText,
  HelpCircle,
  FolderGit2,
  Presentation,
  Megaphone,
  Check,
  Calendar,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import {
  TASK_TYPE_METADATA,
  type TaskType,
} from '@/lib/tasks/taskUtils';

export default function CreateTaskModal() {
  const router = useRouter();
  const { activeSection, courses, activeSectionId } = useWorkspaces();
  const { activeCourses, tasks } = useAppStore();

  const params = useLocalSearchParams<{
    id?: string;
    course_id?: string;
    task_type?: string;
  }>();

  // If editing an existing task, hydrate its values
  const existingTask = useMemo(() => {
    if (!params.id) return null;
    return tasks.find((t) => t.id === params.id) ?? null;
  }, [params.id, tasks]);

  // Form State
  const [title, setTitle] = useState(existingTask?.title ?? '');
  const [description, setDescription] = useState(existingTask?.description ?? '');
  const [taskType, setTaskType] = useState<TaskType>(
    (existingTask?.task_type as TaskType) ??
      (params.task_type as TaskType) ??
      'assignment'
  );

  const enrolledCourses = useMemo(() => {
    return activeCourses.length > 0 ? activeCourses : courses;
  }, [activeCourses, courses]);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    existingTask?.course_id ??
      params.course_id ??
      (enrolledCourses.length > 0 ? enrolledCourses[0].id : null)
  );

  const isEditing = !!existingTask;

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Modal Header */}
        <View className="px-5 pt-3 pb-4 flex-row items-center justify-between border-b border-neutral-200/60 bg-white/80 backdrop-blur-md">
          <View>
            <Text className="text-xl font-black text-neutral-900 tracking-tight">
              {isEditing ? 'Edit Academic Task' : 'New Academic Task'}
            </Text>
            <Text className="text-xs font-medium text-neutral-500 mt-0.5">
              {activeSection?.name || 'Section'}
            </Text>
          </View>

          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="w-9 h-9 rounded-full bg-neutral-100 items-center justify-center active:bg-neutral-200 transition-colors"
          >
            <X size={18} color="#475569" strokeWidth={2.4} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 60, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title Input Card */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Task Title <Text className="text-rose-500">*</Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Midterm Project Submission"
              placeholderTextColor="#94A3B8"
              className="bg-neutral-50 border border-neutral-200/70 rounded-2xl px-4 py-3 text-sm font-semibold text-neutral-900 focus:border-blue-500"
              maxLength={120}
              autoFocus={!isEditing}
            />
          </View>

          {/* Task Type Chips Card */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Task Type
              </Text>
              <View className="flex-row items-center">
                <Sparkles size={12} color="#3B82F6" />
                <Text className="text-[11px] font-bold text-blue-600 ml-1">
                  {TASK_TYPE_METADATA[taskType]?.label}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap -m-1">
              {(
                [
                  'assignment',
                  'quiz',
                  'project',
                  'presentation',
                  'administrative',
                ] as TaskType[]
              ).map((type) => {
                const meta = TASK_TYPE_METADATA[type];
                const isSelected = taskType === type;

                return (
                  <Pressable
                    key={type}
                    onPress={() => setTaskType(type)}
                    style={{
                      backgroundColor: isSelected ? meta.badgeBg : '#F8FAFC',
                      borderColor: isSelected ? meta.borderColor : '#E2E8F0',
                    }}
                    className={`m-1 px-3.5 py-2 rounded-2xl border flex-row items-center transition-all ${
                      isSelected ? 'shadow-xs' : ''
                    }`}
                  >
                    {type === 'assignment' && (
                      <FileText
                        size={14}
                        color={isSelected ? meta.badgeText : '#64748B'}
                      />
                    )}
                    {type === 'quiz' && (
                      <HelpCircle
                        size={14}
                        color={isSelected ? meta.badgeText : '#64748B'}
                      />
                    )}
                    {type === 'project' && (
                      <FolderGit2
                        size={14}
                        color={isSelected ? meta.badgeText : '#64748B'}
                      />
                    )}
                    {type === 'presentation' && (
                      <Presentation
                        size={14}
                        color={isSelected ? meta.badgeText : '#64748B'}
                      />
                    )}
                    {type === 'administrative' && (
                      <Megaphone
                        size={14}
                        color={isSelected ? meta.badgeText : '#64748B'}
                      />
                    )}

                    <Text
                      style={{
                        color: isSelected ? meta.badgeText : '#475569',
                      }}
                      className={`text-xs ml-1.5 ${
                        isSelected ? 'font-black' : 'font-semibold'
                      }`}
                    >
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Course Selector Card */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Course Affiliation
              </Text>
              <BookOpen size={13} color="#94A3B8" />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row -mx-1"
            >
              {/* General / Cohort-wide option (Course ID = null) */}
              <Pressable
                onPress={() => setSelectedCourseId(null)}
                className={`mx-1 px-3.5 py-2.5 rounded-2xl border flex-row items-center ${
                  selectedCourseId === null
                    ? 'bg-neutral-900 border-neutral-900'
                    : 'bg-neutral-50 border-neutral-200/80'
                }`}
              >
                <Layers
                  size={14}
                  color={selectedCourseId === null ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  className={`text-xs font-bold ml-1.5 ${
                    selectedCourseId === null ? 'text-white' : 'text-neutral-700'
                  }`}
                >
                  General / Cohort-wide
                </Text>
              </Pressable>

              {/* Enrolled Courses */}
              {enrolledCourses.map((course) => {
                const isSelected = selectedCourseId === course.id;
                return (
                  <Pressable
                    key={course.id}
                    onPress={() => setSelectedCourseId(course.id)}
                    className={`mx-1 px-3.5 py-2.5 rounded-2xl border flex-row items-center ${
                      isSelected
                        ? 'bg-neutral-900 border-neutral-900'
                        : 'bg-neutral-50 border-neutral-200/80'
                    }`}
                  >
                    <View
                      className="w-2.5 h-2.5 rounded-full mr-2"
                      style={{ backgroundColor: course.color_hex || '#3B82F6' }}
                    />
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-neutral-700'
                      }`}
                      numberOfLines={1}
                    >
                      {course.code || course.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Description Input Card */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Description / Instructions (Optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add submission links, guidelines, or materials..."
              placeholderTextColor="#94A3B8"
              className="bg-neutral-50 border border-neutral-200/70 rounded-2xl p-4 text-xs font-medium text-neutral-800 focus:border-blue-500"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
