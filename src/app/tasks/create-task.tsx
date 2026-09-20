// ============================================================================
// ClassSync Academic Task Publishing & Edit Modal
// File: src/app/tasks/create-task.tsx
// Description: Presentation modal for creating and updating academic tasks,
//              featuring soft UI inputs, task type chips, course selector,
//              cross-platform web-safe date picker, strict CR cohort broadcast
//              authorization guards, and atomic mutation submission.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
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
  Lock,
  ShieldCheck,
  User,
  Users,
  AlertCircle,
  Send,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicTasks } from '@/hooks/useAcademicTasks';
import { DateTimePickerWebSafe } from '@/components/tasks/DateTimePickerWebSafe';
import {
  TASK_TYPE_METADATA,
  type TaskType,
} from '@/lib/tasks/taskUtils';

export default function CreateTaskModal() {
  const router = useRouter();
  const { activeSection, courses, activeSectionId } = useWorkspaces();
  const { activeCourses, tasks } = useAppStore();
  const { upsertTask, isUpserting, isSectionAdmin } = useAcademicTasks();

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

  const [dueDateTime, setDueDateTime] = useState<Date>(() => {
    if (existingTask?.due_datetime) {
      return new Date(existingTask.due_datetime);
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 0, 0);
    return d;
  });

  // CRITICAL DIRECTIVE: Default is_personal = true.
  // The toggle to broadcast to the cohort (is_personal = false) MUST be strictly disabled
  // unless the user is a genesis_cr or co_admin.
  const [isPersonal, setIsPersonal] = useState<boolean>(
    existingTask ? existingTask.is_personal : true
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = !!existingTask;

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter a task title.');
      return;
    }

    if (!activeSectionId) {
      setErrorMessage('No active section found. Please enroll or create a section first.');
      return;
    }

    setErrorMessage(null);

    try {
      await upsertTask({
        id: existingTask?.id,
        section_id: activeSectionId,
        course_id: selectedCourseId,
        title: title.trim(),
        description: description.trim() || null,
        task_type: taskType,
        due_datetime: dueDateTime.toISOString(),
        // Non-admins are strictly forced to is_personal = true
        is_personal: isSectionAdmin ? isPersonal : true,
      });

      router.back();
    } catch (err: any) {
      console.error('[CreateTaskModal] Failed to upsert task:', err);
      setErrorMessage(
        err?.message || 'Failed to save academic task. Please check your connection and retry.'
      );
    }
  };

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
              {activeSection?.name || 'Academic Workspace'}
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
          {/* Error Banner */}
          {errorMessage && (
            <View className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex-row items-start">
              <AlertCircle size={16} color="#E11D48" className="mt-0.5" />
              <Text className="text-xs font-semibold text-rose-700 ml-2.5 flex-1 leading-relaxed">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* Title Input Card */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
              Task Title <Text className="text-rose-500">*</Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errorMessage) setErrorMessage(null);
              }}
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
                  General / Announcement
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

          {/* Due Date & Time Picker (Cross-platform with strict web fallback) */}
          <DateTimePickerWebSafe
            value={dueDateTime}
            onChange={setDueDateTime}
          />

          {/* Broadcast Scope & CR Guard Card */}
          <View className="bg-white rounded-3xl p-4 mb-4 border border-neutral-100/90 shadow-2xs">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Audience & Visibility
              </Text>
              {isSectionAdmin ? (
                <View className="flex-row items-center bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  <ShieldCheck size={12} color="#2563EB" />
                  <Text className="text-[10px] font-bold text-blue-700 ml-1">
                    CR Authorized
                  </Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-200/60">
                  <Lock size={11} color="#64748B" />
                  <Text className="text-[10px] font-bold text-neutral-600 ml-1">
                    Personal Only
                  </Text>
                </View>
              )}
            </View>

            {/* Broadcast Selection: Strictly disabled for regular members */}
            {isSectionAdmin ? (
              <View className="flex-row -mx-1">
                {/* Personal Option */}
                <Pressable
                  onPress={() => setIsPersonal(true)}
                  className={`flex-1 mx-1 p-3.5 rounded-2xl border transition-all ${
                    isPersonal
                      ? 'bg-neutral-900 border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 border-neutral-200/80 active:bg-neutral-100'
                  }`}
                >
                  <View className="flex-row items-center mb-1">
                    <User size={14} color={isPersonal ? '#FFFFFF' : '#475569'} />
                    <Text
                      className={`text-xs font-bold ml-1.5 ${
                        isPersonal ? 'text-white' : 'text-neutral-800'
                      }`}
                    >
                      Personal Only
                    </Text>
                  </View>
                  <Text
                    className={`text-[10px] font-medium leading-tight ${
                      isPersonal ? 'text-neutral-300' : 'text-neutral-500'
                    }`}
                  >
                    Private to your schedule
                  </Text>
                </Pressable>

                {/* Cohort Broadcast Option */}
                <Pressable
                  onPress={() => setIsPersonal(false)}
                  className={`flex-1 mx-1 p-3.5 rounded-2xl border transition-all ${
                    !isPersonal
                      ? 'bg-blue-600 border-blue-600 shadow-xs'
                      : 'bg-neutral-50 border-neutral-200/80 active:bg-neutral-100'
                  }`}
                >
                  <View className="flex-row items-center mb-1">
                    <Users size={14} color={!isPersonal ? '#FFFFFF' : '#475569'} />
                    <Text
                      className={`text-xs font-bold ml-1.5 ${
                        !isPersonal ? 'text-white' : 'text-neutral-800'
                      }`}
                    >
                      Broadcast Cohort
                    </Text>
                  </View>
                  <Text
                    className={`text-[10px] font-medium leading-tight ${
                      !isPersonal ? 'text-blue-100' : 'text-neutral-500'
                    }`}
                  >
                    Syncs to entire section
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Informative card for regular students */
              <View className="flex-row items-start bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60">
                <User size={16} color="#3B82F6" className="mt-0.5" />
                <View className="ml-2.5 flex-1">
                  <Text className="text-xs font-bold text-neutral-800">
                    Personal Task (Private Checklist)
                  </Text>
                  <Text className="text-[11px] font-medium text-neutral-500 mt-0.5 leading-relaxed">
                    This task is only visible to you. Cohort-wide broadcasting is restricted to Section Admins (Genesis CR and Co-Admins).
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Description Input Card */}
          <View className="bg-white rounded-3xl p-4 mb-6 border border-neutral-100/90 shadow-2xs">
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
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>

          {/* Submit Action Button */}
          <Pressable
            onPress={handleSave}
            disabled={isUpserting}
            className={`w-full py-4 rounded-2xl flex-row items-center justify-center transition-all ${
              isUpserting
                ? 'bg-neutral-400'
                : !isPersonal
                ? 'bg-blue-600 active:bg-blue-700 shadow-md shadow-blue-500/20'
                : 'bg-neutral-900 active:bg-neutral-800 shadow-md shadow-neutral-900/20'
            }`}
          >
            {isUpserting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                {!isPersonal ? (
                  <Send size={16} color="#FFFFFF" strokeWidth={2.4} />
                ) : (
                  <Check size={16} color="#FFFFFF" strokeWidth={2.6} />
                )}
                <Text className="text-sm font-black text-white ml-2">
                  {isEditing
                    ? 'Save Changes'
                    : !isPersonal
                    ? 'Broadcast to Section Cohort'
                    : 'Create Personal Task'}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
