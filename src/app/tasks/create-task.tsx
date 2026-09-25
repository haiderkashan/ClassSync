// ============================================================================
// ClassSync Academic Task Publishing & Edit Modal
// File: src/app/tasks/create-task.tsx
// Description: Overhauled mobile bottom sheet modal for creating and updating
//              academic tasks, generated via Stitch UI overhaul.
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
  Alert,
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
  Lock,
  Users,
  AlertCircle,
  Trash2,
  GraduationCap,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicTasks } from '@/hooks/useAcademicTasks';
import { DateTimePickerWebSafe } from '@/components/tasks/DateTimePickerWebSafe';
import {
  TASK_TYPE_METADATA,
  type TaskType,
} from '@/lib/tasks/taskUtils';
import type { CourseRow } from '@/store/useAppStore';

const CATEGORIES: { id: TaskType; label: string; icon: any }[] = [
  { id: 'assignment', label: 'Assignment', icon: FileText },
  { id: 'quiz', label: 'Quiz / Exam', icon: HelpCircle },
  { id: 'project', label: 'Project', icon: FolderGit2 },
  { id: 'presentation', label: 'Presentation', icon: Presentation },
  { id: 'administrative', label: 'Administrative', icon: Megaphone },
];

export default function CreateTaskModal() {
  const router = useRouter();
  const { activeSection, courses, activeSectionId } = useWorkspaces();
  const { activeCourses, tasks } = useAppStore();
  const { upsertTask, isUpserting, deleteTask, isDeleting, isSectionAdmin } =
    useAcademicTasks();

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

  // Default is_personal = true unless CR broadcasts to cohort
  const [isPersonal, setIsPersonal] = useState<boolean>(
    existingTask ? existingTask.is_personal : true
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = !!existingTask;
  const activeSectionName = activeSection?.name || 'ClassSync Cohort';

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

  const handleDelete = () => {
    if (!existingTask) return;

    Alert.alert(
      'Delete Academic Task',
      `Are you sure you want to delete "${existingTask.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(existingTask.id);
              router.back();
            } catch (err: any) {
              setErrorMessage(err?.message || 'Failed to delete task.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'left', 'right', 'bottom']}>
      {/* 1. Modal Top Bar & Drag Handle */}
      <View className="px-5 pt-2 pb-3 bg-white border-b border-neutral-200/80">
        <View className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-3" />
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-lg font-black text-neutral-900 tracking-tight">
              {isEditing ? 'Edit Academic Task' : 'Create Academic Task'}
            </Text>
            <View className="flex-row items-center space-x-1.5 mt-0.5">
              <View className="w-1.5 h-1.5 rounded-full bg-[#FACC15]" />
              <Text className="text-xs text-neutral-500 font-semibold" numberOfLines={1}>
                {activeSectionName}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-neutral-100 border border-neutral-200/80 items-center justify-center active:bg-neutral-200"
            accessibilityLabel="Close modal"
          >
            <X size={18} color="#18181B" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Error Message Alert */}
          {errorMessage && (
            <View className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex-row items-center space-x-2">
              <AlertCircle size={16} color="#E11D48" />
              <Text className="text-xs text-rose-700 font-bold flex-1 ml-1.5">
                {errorMessage}
              </Text>
            </View>
          )}

          {/* 2. Task Title Input */}
          <View className="mb-4 bg-white border border-neutral-200/90 rounded-2xl p-3.5 focus-within:border-[#FACC15] shadow-2xs">
            <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-1">
              TASK TITLE
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Distributed Systems Lab 3"
              placeholderTextColor="#A1A1AA"
              className="text-base font-bold text-neutral-900 p-0"
            />
          </View>

          {/* 3. Description / Notes Textarea */}
          <View className="mb-5 bg-white border border-neutral-200/90 rounded-2xl p-3.5 focus-within:border-[#FACC15] shadow-2xs">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                NOTES & SUBMISSION DETAILS
              </Text>
              <Text className="text-[10px] font-medium text-neutral-400">
                Optional
              </Text>
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add instructions, submission links, or rubric notes..."
              placeholderTextColor="#A1A1AA"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="text-sm font-medium text-neutral-800 p-0 min-h-[70px]"
            />
          </View>

          {/* 4. Category Chips */}
          <View className="mb-5">
            <Text className="text-[11px] font-black text-neutral-400 uppercase tracking-wider px-1 mb-2">
              CATEGORY
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 flex-row py-1">
              {CATEGORIES.map((cat) => {
                const isSelected = taskType === cat.id;
                const IconComponent = cat.icon;

                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setTaskType(cat.id)}
                    className={`mr-2 px-3.5 py-2.5 rounded-2xl flex-row items-center space-x-1.5 border transition-all ${
                      isSelected
                        ? 'bg-[#FACC15] border-[#EAB308] shadow-2xs'
                        : 'bg-white border-neutral-200/80 active:bg-neutral-100'
                    }`}
                  >
                    <IconComponent
                      size={14}
                      color="#18181B"
                      strokeWidth={isSelected ? 2.5 : 2}
                    />
                    <Text
                      className={`text-xs ml-1 ${
                        isSelected
                          ? 'font-black text-neutral-950'
                          : 'font-bold text-neutral-700'
                      }`}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 5. Linked Course Selector Strip */}
          <View className="mb-5">
            <View className="flex-row items-center justify-between px-1 mb-2">
              <Text className="text-[11px] font-black text-neutral-400 uppercase tracking-wider">
                LINKED COURSE
              </Text>
              <Text className="text-[11px] font-semibold text-neutral-500">
                {enrolledCourses.length} Courses
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4 flex-row py-1">
              {/* General / No Course Chip */}
              <Pressable
                onPress={() => setSelectedCourseId(null)}
                className={`mr-2.5 px-4 py-3 rounded-2xl border min-w-[150px] justify-between transition-all ${
                  selectedCourseId === null
                    ? 'bg-[#FACC15]/15 border-[#EAB308] shadow-2xs'
                    : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                }`}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                    <Text className="text-[10px] font-bold text-neutral-600">GENERAL</Text>
                  </View>
                  {selectedCourseId === null && (
                    <View className="w-5 h-5 rounded-full bg-[#FACC15] items-center justify-center">
                      <Check size={12} color="#18181B" strokeWidth={3} />
                    </View>
                  )}
                </View>
                <Text className="text-xs font-bold text-neutral-900">
                  Cohort General
                </Text>
              </Pressable>

              {/* Individual Enrolled Courses */}
              {enrolledCourses.map((c: CourseRow) => {
                const isSelected = selectedCourseId === c.id;
                const color = c.color_hex || '#FACC15';

                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedCourseId(c.id)}
                    className={`mr-2.5 px-4 py-3 rounded-2xl border min-w-[170px] justify-between transition-all ${
                      isSelected
                        ? 'bg-[#FACC15]/15 border-[#EAB308] shadow-2xs'
                        : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                        <Text className="text-[10px] font-black font-mono text-neutral-800">
                          {c.code || 'COURSE'}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View className="w-5 h-5 rounded-full bg-[#FACC15] items-center justify-center">
                          <Check size={12} color="#18181B" strokeWidth={3} />
                        </View>
                      ) : (
                        <View
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      )}
                    </View>
                    <View>
                      <Text className="text-xs font-black text-neutral-900" numberOfLines={1}>
                        {c.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 6. Deadline & Time Picker (Web-Safe & Native) */}
          <View className="mb-5 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
            <Text className="text-[11px] font-black text-neutral-400 uppercase tracking-wider mb-2.5">
              DEADLINE & DUE TIME
            </Text>
            <DateTimePickerWebSafe
              value={dueDateTime}
              onChange={(newDate) => setDueDateTime(newDate)}
            />
          </View>

          {/* 7. Visibility & Cohort Broadcast Control */}
          <View className="mb-6 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
            <Text className="text-[11px] font-black text-neutral-400 uppercase tracking-wider mb-2">
              VISIBILITY & COHORT SYNC
            </Text>

            <View className="p-1 rounded-2xl bg-neutral-100 flex-row">
              {/* Option 1: Personal */}
              <Pressable
                onPress={() => setIsPersonal(true)}
                className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row space-x-1.5 transition-all ${
                  isPersonal
                    ? 'bg-white shadow-xs border border-neutral-200/60'
                    : 'active:bg-neutral-200/60'
                }`}
              >
                {isPersonal && (
                  <View className="w-1.5 h-1.5 rounded-full bg-[#FACC15] mr-1" />
                )}
                <Text
                  className={`text-xs font-black ${
                    isPersonal ? 'text-neutral-950' : 'text-neutral-600'
                  }`}
                >
                  Personal Task
                </Text>
              </Pressable>

              {/* Option 2: Cohort Broadcast (CR Only) */}
              <Pressable
                onPress={() => {
                  if (isSectionAdmin) {
                    setIsPersonal(false);
                  } else {
                    Alert.alert(
                      'Representative Broadcast Restricted',
                      'Cohort-wide deadline broadcasts are exclusive to verified Class Representatives (Genesis CR / Co-Admins).'
                    );
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row space-x-1.5 transition-all ${
                  !isPersonal
                    ? 'bg-white shadow-xs border border-neutral-200/60'
                    : 'active:bg-neutral-200/60'
                }`}
              >
                {!isSectionAdmin ? (
                  <Lock size={12} color="#71717A" />
                ) : !isPersonal ? (
                  <View className="w-1.5 h-1.5 rounded-full bg-[#FACC15] mr-1" />
                ) : null}
                <Text
                  className={`text-xs font-black ${
                    !isPersonal ? 'text-neutral-950' : 'text-neutral-600'
                  }`}
                >
                  Cohort Broadcast
                </Text>
                {!isSectionAdmin && (
                  <View className="px-1.5 py-0.2 rounded bg-neutral-200">
                    <Text className="text-[9px] font-bold text-neutral-600">CR</Text>
                  </View>
                )}
              </Pressable>
            </View>

            <Text className="text-[11px] text-neutral-500 mt-2 font-medium leading-relaxed">
              {isPersonal
                ? 'Personal tasks remain private and sync only across your own devices.'
                : 'Cohort tasks will immediately broadcast to all enrolled section peers.'}
            </Text>
          </View>
        </ScrollView>

        {/* 8. Sticky Bottom Action Area */}
        <View className="absolute bottom-0 inset-x-0 bg-white/95 border-t border-neutral-200/80 px-4 pt-3 pb-6 shadow-lg">
          <Pressable
            onPress={handleSave}
            disabled={isUpserting}
            className={`w-full py-4 rounded-2xl items-center justify-center flex-row space-x-2 shadow-sm ${
              isUpserting
                ? 'bg-neutral-300'
                : 'bg-[#FACC15] active:bg-yellow-400'
            }`}
          >
            {isUpserting ? (
              <ActivityIndicator size="small" color="#18181B" />
            ) : (
              <>
                <Check size={18} color="#18181B" strokeWidth={2.5} />
                <Text className="text-neutral-950 text-sm font-black tracking-wide ml-1.5">
                  {isEditing ? 'Save Changes' : 'Create Academic Task'}
                </Text>
              </>
            )}
          </Pressable>

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              disabled={isDeleting}
              className="w-full py-2.5 mt-1.5 items-center justify-center flex-row space-x-1.5 active:bg-rose-50 rounded-xl"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#E11D48" />
              ) : (
                <>
                  <Trash2 size={15} color="#E11D48" />
                  <Text className="text-xs font-bold text-rose-600 ml-1">
                    Delete Task
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
