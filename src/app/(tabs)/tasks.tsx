// ============================================================================
// ClassSync Academic Tasks Screen
// File: src/app/(tabs)/tasks.tsx
// Description: Main tasks dashboard featuring Master Segmented Toggle
//              ("Pending" vs "Completed"), high-performance SectionList
//              for deadline grouping (Overdue, Due Soon rolling 7-day, Upcoming),
//              FlatList for Completed archive, course filter pills, and FAB.
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  SectionList,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import {
  Plus,
  Clock,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Sparkles,
  Layers,
  Inbox,
  CheckCheck,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore, type AcademicTaskRow } from '@/store/useAppStore';
import { useAcademicTasks } from '@/hooks/useAcademicTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import {
  groupTasksByDeadline,
  filterTasks,
  type TaskType,
} from '@/lib/tasks/taskUtils';

interface TaskSection {
  title: string;
  key: 'overdue' | 'dueSoon' | 'upcoming';
  data: AcademicTaskRow[];
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  icon: any;
}

export default function TasksScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { activeSection, courses } = useWorkspaces();
  const { activeCourses } = useAppStore();

  const {
    tasks,
    completionSet,
    isLoading,
    isFetching,
    refetch,
    toggleTaskCompletion,
    deleteTask,
    isSectionAdmin,
  } = useAcademicTasks();

  // Master Segmented Toggle: 'pending' vs 'completed' (Deficiency 1 Fix)
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // Course Filter
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const enrolledCourses = useMemo(() => {
    return activeCourses.length > 0 ? activeCourses : courses;
  }, [activeCourses, courses]);

  // 1. Filter tasks by course (if selected)
  const filteredTasks = useMemo(() => {
    return filterTasks(tasks, {
      courseId: selectedCourseId,
    });
  }, [tasks, selectedCourseId]);

  // 2. Group filtered tasks using the rolling 7-day window engine
  const groupedTasks = useMemo(() => {
    return groupTasksByDeadline(filteredTasks, completionSet);
  }, [filteredTasks, completionSet]);

  // Total tab counts across all unfiltered tasks
  const allGroupedTasks = useMemo(() => {
    return groupTasksByDeadline(tasks, completionSet);
  }, [tasks, completionSet]);

  const pendingCount = allGroupedTasks.pendingCount;
  const completedCount = allGroupedTasks.completed.length;

  // 3. Construct SectionList sections for Pending view
  const pendingSections: TaskSection[] = useMemo(() => {
    const sections: TaskSection[] = [];

    if (groupedTasks.overdue.length > 0) {
      sections.push({
        title: 'Overdue',
        key: 'overdue',
        data: groupedTasks.overdue,
        badgeColor: '#E11D48',
        badgeBg: '#FFF1F2',
        badgeBorder: '#FECDD3',
        icon: AlertTriangle,
      });
    }

    if (groupedTasks.dueSoon.length > 0) {
      sections.push({
        title: 'Due Soon (Next 7 Days)',
        key: 'dueSoon',
        data: groupedTasks.dueSoon,
        badgeColor: '#D97706',
        badgeBg: '#FEF08A',
        badgeBorder: '#FACC15',
        icon: Clock,
      });
    }

    if (groupedTasks.upcoming.length > 0) {
      sections.push({
        title: 'Upcoming',
        key: 'upcoming',
        data: groupedTasks.upcoming,
        badgeColor: '#475569',
        badgeBg: '#F8FAFC',
        badgeBorder: '#E2E8F0',
        icon: Calendar,
      });
    }

    return sections;
  }, [groupedTasks]);

  // Empty State: Pending View
  const renderPendingEmptyState = () => (
    <View className="py-16 px-6 items-center justify-center">
      <View className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 items-center justify-center mb-4 shadow-xs">
        <Sparkles size={28} color="#059669" strokeWidth={2.2} />
      </View>
      <Text className="text-lg font-black text-neutral-900 tracking-tight mb-1 text-center">
        {selectedCourseId ? 'No Pending Tasks for Course' : 'All Caught Up! 🎉'}
      </Text>
      <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs leading-relaxed mb-6">
        {selectedCourseId
          ? 'There are no active deadlines for this course. Switch to All Courses or create a new task.'
          : 'You have completed all scheduled assignments, quizzes, and project milestones.'}
      </Text>

      <Pressable
        onPress={() => router.push('/tasks/create-task')}
        className="px-5 py-2.5 rounded-full bg-neutral-900 flex-row items-center shadow-xs active:bg-neutral-800"
      >
        <Plus size={14} color="#FFFFFF" strokeWidth={2.6} />
        <Text className="text-xs font-bold text-white ml-1.5">Add New Task</Text>
      </Pressable>
    </View>
  );

  // Empty State: Completed Archive View
  const renderCompletedEmptyState = () => (
    <View className="py-16 px-6 items-center justify-center">
      <View className="w-16 h-16 rounded-3xl bg-neutral-100 border border-neutral-200/60 items-center justify-center mb-4">
        <CheckCheck size={28} color="#94A3B8" strokeWidth={2} />
      </View>
      <Text className="text-lg font-black text-neutral-900 tracking-tight mb-1 text-center">
        Archive is Empty
      </Text>
      <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs leading-relaxed">
        Check off tasks from your Pending list to archive them here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'left', 'right']}>
      {/* Top Header & Sticky Navigation */}
      <View className="px-5 pt-3 pb-2 bg-white border-b border-neutral-200/50">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-2xl font-black text-neutral-900 tracking-tight">
              Academic Tasks
            </Text>
            <Text className="text-xs font-semibold text-neutral-500 mt-0.5">
              {activeSection?.name || 'Academic Workspace'}
            </Text>
          </View>

          {/* Header Quick Add Button */}
          <Pressable
            onPress={() => router.push('/tasks/create-task')}
            className="flex-row items-center bg-[#FEF08A]/80 border border-[#FACC15] px-3.5 py-1.5 rounded-full active:bg-[#FEF08A] shadow-2xs"
          >
            <Plus size={14} color="#18181B" strokeWidth={2.6} />
            <Text className="text-xs font-bold text-neutral-900 ml-1">New Task</Text>
          </Pressable>
        </View>

        {/* Master Segmented Toggle ("Pending" vs "Completed") */}
        <View className="bg-neutral-100 p-1 rounded-2xl flex-row mb-3 border border-neutral-200/60">
          {/* Pending Tab */}
          <Pressable
            onPress={() => setActiveTab('pending')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center transition-all ${
              activeTab === 'pending'
                ? 'bg-[#FACC15] shadow-xs'
                : 'active:bg-neutral-200/50'
            }`}
          >
            <Clock
              size={13}
              color={activeTab === 'pending' ? '#18181B' : '#71717A'}
              strokeWidth={2.4}
            />
            <Text
              className={`text-xs ml-1.5 ${
                activeTab === 'pending'
                  ? 'font-black text-[#18181B]'
                  : 'font-semibold text-neutral-500'
              }`}
            >
              Pending
            </Text>
            <View
              className={`ml-1.5 px-1.5 py-0.2 rounded-full ${
                activeTab === 'pending' ? 'bg-[#18181B]' : 'bg-neutral-200'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  activeTab === 'pending' ? 'text-[#FACC15]' : 'text-neutral-600'
                }`}
              >
                {pendingCount}
              </Text>
            </View>
          </Pressable>

          {/* Completed Archive Tab */}
          <Pressable
            onPress={() => setActiveTab('completed')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center transition-all ${
              activeTab === 'completed'
                ? 'bg-[#18181B] shadow-xs'
                : 'active:bg-neutral-200/50'
            }`}
          >
            <CheckCircle2
              size={13}
              color={activeTab === 'completed' ? '#34D399' : '#71717A'}
              strokeWidth={2.4}
            />
            <Text
              className={`text-xs ml-1.5 ${
                activeTab === 'completed'
                  ? 'font-black text-white'
                  : 'font-semibold text-neutral-500'
              }`}
            >
              Completed
            </Text>
            <View
              className={`ml-1.5 px-1.5 py-0.2 rounded-full ${
                activeTab === 'completed' ? 'bg-emerald-600' : 'bg-neutral-200'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  activeTab === 'completed' ? 'text-white' : 'text-neutral-600'
                }`}
              >
                {completedCount}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Horizontal Course Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row -mx-1 pb-1"
        >
          {/* All Courses Chip */}
          <Pressable
            onPress={() => setSelectedCourseId(null)}
            className={`mx-1 px-3 py-1.5 rounded-full border transition-all ${
              selectedCourseId === null
                ? 'bg-neutral-900 border-neutral-900 shadow-xs'
                : 'bg-white border-neutral-200/80 active:bg-neutral-50'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                selectedCourseId === null ? 'text-white' : 'text-neutral-600'
              }`}
            >
              All Courses
            </Text>
          </Pressable>

          {/* Individual Courses */}
          {enrolledCourses.map((course) => {
            const isSelected = selectedCourseId === course.id;
            return (
              <Pressable
                key={course.id}
                onPress={() => setSelectedCourseId(course.id)}
                className={`mx-1 px-3 py-1.5 rounded-full border flex-row items-center transition-all ${
                  isSelected
                    ? 'bg-neutral-900 border-neutral-900 shadow-xs'
                    : 'bg-white border-neutral-200/80 active:bg-neutral-50'
                }`}
              >
                <View
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: course.color_hex || '#3B82F6' }}
                />
                <Text
                  className={`text-xs font-bold ${
                    isSelected ? 'text-white' : 'text-neutral-700'
                  }`}
                >
                  {course.code || course.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List Rendering */}
      {isLoading && tasks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#2563EB" />
          <Text className="text-xs font-semibold text-neutral-500 mt-2">
            Loading academic tasks...
          </Text>
        </View>
      ) : activeTab === 'pending' ? (
        /* High-Performance SectionList for Pending Tasks (Deficiency 3 Fix) */
        <SectionList<AcademicTaskRow, TaskSection>
          sections={pendingSections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 100, // Space for FAB & Floating Nav Pill
          }}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} />
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center justify-between pt-4 pb-2 bg-[#F8F9FA]">
              <View className="flex-row items-center">
                <section.icon size={13} color={section.badgeColor} />
                <Text className="text-xs font-black text-neutral-800 ml-1.5 uppercase tracking-wider">
                  {section.title}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: section.badgeBg,
                  borderColor: section.badgeBorder,
                }}
                className="px-2 py-0.2 rounded-full border"
              >
                <Text
                  style={{ color: section.badgeColor }}
                  className="text-[10px] font-black"
                >
                  {section.data.length}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              isCompleted={false}
              onToggleComplete={toggleTaskCompletion}
              onEdit={(t) => router.push(`/tasks/create-task?id=${t.id}`)}
              onDelete={deleteTask}
              currentUserId={user?.id}
              isSectionAdmin={isSectionAdmin}
            />
          )}
          ListEmptyComponent={renderPendingEmptyState}
        />
      ) : (
        /* FlatList for Completed Archive (Deficiency 3 Fix) */
        <FlatList<AcademicTaskRow>
          data={groupedTasks.completed}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 100, // Space for FAB & Floating Nav Pill
          }}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} />
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              isCompleted={true}
              onToggleComplete={toggleTaskCompletion}
              onEdit={(t) => router.push(`/tasks/create-task?id=${t.id}`)}
              onDelete={deleteTask}
              currentUserId={user?.id}
              isSectionAdmin={isSectionAdmin}
            />
          )}
          ListEmptyComponent={renderCompletedEmptyState}
        />
      )}

      {/* Floating Action Button (FAB) */}
      <View className="absolute bottom-24 right-5">
        <Pressable
          onPress={() => router.push('/tasks/create-task')}
          className="bg-[#FACC15] px-5 py-3.5 rounded-full shadow-lg shadow-black/10 flex-row items-center active:bg-[#EAB308] transition-transform active:scale-95"
        >
          <Plus size={18} color="#18181B" strokeWidth={2.6} />
          <Text className="text-xs font-black text-neutral-900 ml-2">New Task</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
