// ============================================================================
// ClassSync Academic Tasks Screen
// File: src/app/(tabs)/tasks.tsx
// Description: Overhauled mobile tasks dashboard generated via Stitch UI.
//              Features Master Segmented Control, horizontal course rail,
//              SectionList deadline grouping (Overdue, Due Soon, Upcoming),
//              and floating yellow '+ New Task' action pill.
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
  Inbox,
  CheckCheck,
  GraduationCap,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore, type AcademicTaskRow } from '@/store/useAppStore';
import { useAcademicTasks } from '@/hooks/useAcademicTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import {
  groupTasksByDeadline,
  filterTasks,
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

  // Master Segmented Toggle: 'pending' vs 'completed'
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
        badgeColor: '#854D0E',
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
        badgeColor: '#52525B',
        badgeBg: '#F4F4F5',
        badgeBorder: '#E4E4E7',
        icon: Calendar,
      });
    }

    return sections;
  }, [groupedTasks]);

  const activeSectionName = activeSection?.name || 'ClassSync Cohort';

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF9]" edges={['top', 'left', 'right']}>
      {/* 1. Mobile Header */}
      <View className="px-5 pt-2 pb-3 bg-white border-b border-neutral-200/80">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-2.5 flex-1 mr-2">
            <View className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200/80 items-center justify-center">
              <GraduationCap size={18} color="#18181B" strokeWidth={2.2} />
            </View>
            <View className="flex-1 ml-1.5">
              <Text className="text-xl font-black text-neutral-900 tracking-tight" numberOfLines={1}>
                Academic Tasks
              </Text>
              <View className="flex-row items-center space-x-1.5 mt-0.5">
                <Text className="text-[11px] font-semibold text-neutral-500" numberOfLines={1}>
                  {activeSectionName}
                </Text>
                <View className="w-1 h-1 rounded-full bg-neutral-300" />
                <Text className="text-[11px] font-bold text-neutral-900">
                  {pendingCount} Pending
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Add Button in Header */}
          <Pressable
            onPress={() => router.push('/tasks/create-task')}
            className="flex-row items-center space-x-1 bg-[#FACC15] px-3 py-1.5 rounded-xl active:bg-yellow-400 shadow-2xs"
            accessibilityLabel="Add Task"
          >
            <Plus size={14} color="#18181B" strokeWidth={2.5} />
            <Text className="text-xs font-black text-neutral-950 ml-0.5">New</Text>
          </Pressable>
        </View>

        {/* 2. Master Segmented Control */}
        <View className="w-full bg-neutral-100 p-1 rounded-2xl flex-row items-center mt-3 border border-neutral-200/60">
          <Pressable
            onPress={() => setActiveTab('pending')}
            className={`flex-1 py-2 px-3 rounded-xl flex-row items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'pending'
                ? 'bg-[#FACC15] shadow-xs'
                : 'active:bg-neutral-200/50'
            }`}
          >
            <Text
              className={`text-xs font-black ${
                activeTab === 'pending' ? 'text-neutral-950' : 'text-neutral-500'
              }`}
            >
              Pending
            </Text>
            <View
              className={`px-1.5 py-0.2 rounded-full ${
                activeTab === 'pending' ? 'bg-neutral-950/10' : 'bg-neutral-200'
              }`}
            >
              <Text
                className={`text-[10px] font-extrabold ${
                  activeTab === 'pending' ? 'text-neutral-950' : 'text-neutral-600'
                }`}
              >
                {pendingCount}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('completed')}
            className={`flex-1 py-2 px-3 rounded-xl flex-row items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'completed'
                ? 'bg-[#FACC15] shadow-xs'
                : 'active:bg-neutral-200/50'
            }`}
          >
            <Text
              className={`text-xs font-black ${
                activeTab === 'completed' ? 'text-neutral-950' : 'text-neutral-500'
              }`}
            >
              Completed
            </Text>
            <View
              className={`px-1.5 py-0.2 rounded-full ${
                activeTab === 'completed' ? 'bg-neutral-950/10' : 'bg-neutral-200'
              }`}
            >
              <Text
                className={`text-[10px] font-extrabold ${
                  activeTab === 'completed' ? 'text-neutral-950' : 'text-neutral-600'
                }`}
              >
                {completedCount}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* 3. Horizontal Course Filter Rail */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-2.5 -mx-5 px-5 flex-row py-1"
        >
          {/* All Courses Chip */}
          <Pressable
            onPress={() => setSelectedCourseId(null)}
            className={`mr-2 h-8 px-3.5 rounded-full flex-row items-center space-x-1.5 border transition-all ${
              selectedCourseId === null
                ? 'bg-[#FACC15]/20 border-[#FACC15] shadow-2xs'
                : 'bg-white border-neutral-200 active:bg-neutral-50'
            }`}
          >
            <Text
              className={`text-xs font-black ${
                selectedCourseId === null ? 'text-neutral-950' : 'text-neutral-700'
              }`}
            >
              All Courses
            </Text>
            <View
              className={`px-1.5 py-0.2 rounded-full ${
                selectedCourseId === null ? 'bg-[#FACC15]' : 'bg-neutral-100'
              }`}
            >
              <Text className="text-[10px] font-extrabold text-neutral-950">
                {tasks.length}
              </Text>
            </View>
          </Pressable>

          {/* Individual Enrolled Course Chips */}
          {enrolledCourses.map((c) => {
            const isSelected = selectedCourseId === c.id;
            const courseTaskCount = tasks.filter((t) => t.course_id === c.id).length;

            return (
              <Pressable
                key={c.id}
                onPress={() => setSelectedCourseId(c.id)}
                className={`mr-2 h-8 px-3 rounded-full flex-row items-center space-x-1.5 border transition-all ${
                  isSelected
                    ? 'bg-[#FACC15]/20 border-[#FACC15] shadow-2xs'
                    : 'bg-white border-neutral-200 active:bg-neutral-50'
                }`}
              >
                <View
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.color_hex || '#FACC15' }}
                />
                <Text
                  className={`text-xs font-bold ${
                    isSelected ? 'text-neutral-950' : 'text-neutral-700'
                  }`}
                  numberOfLines={1}
                >
                  {c.code || c.name}
                </Text>
                {courseTaskCount > 0 && (
                  <Text className="text-[10px] text-neutral-400 font-bold">
                    ({courseTaskCount})
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Main Content Area */}
      <View className="flex-1 px-4 pt-3">
        {isLoading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#18181B" />
            <Text className="text-xs font-semibold text-neutral-400 mt-3">
              Syncing academic deadlines...
            </Text>
          </View>
        ) : activeTab === 'pending' ? (
          /* PENDING SECTIONLIST */
          pendingSections.length === 0 ? (
            <View className="py-16 px-6 items-center justify-center bg-white border border-neutral-200/80 rounded-3xl shadow-2xs my-4">
              <View className="w-14 h-14 rounded-2xl bg-[#FACC15]/20 border border-[#FACC15]/40 items-center justify-center mb-3">
                <Sparkles size={24} color="#854D0E" strokeWidth={2} />
              </View>
              <Text className="text-base font-black text-neutral-900 mb-1 text-center">
                All Caught Up!
              </Text>
              <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs mb-5 leading-relaxed">
                You have no pending deadlines or assignments scheduled right now. Tap below to create a personal study task.
              </Text>

              <Pressable
                onPress={() => router.push('/tasks/create-task')}
                className="flex-row items-center space-x-1.5 bg-[#FACC15] px-4 py-2.5 rounded-full active:bg-yellow-400 shadow-sm"
              >
                <Plus size={15} color="#18181B" strokeWidth={2.5} />
                <Text className="text-neutral-950 font-black text-xs ml-1">
                  Add First Academic Task
                </Text>
              </Pressable>
            </View>
          ) : (
            <SectionList
              sections={pendingSections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 110 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#18181B" />
              }
              renderSectionHeader={({ section }) => {
                const IconComponent = section.icon;

                return (
                  <View className="flex-row items-center justify-between pt-3 pb-2 bg-[#FAFAF9]">
                    <View className="flex-row items-center space-x-2">
                      <View
                        className="px-2.5 py-1 rounded-full flex-row items-center space-x-1 border"
                        style={{
                          backgroundColor: section.badgeBg,
                          borderColor: section.badgeBorder,
                        }}
                      >
                        <IconComponent size={11} color={section.badgeColor} />
                        <Text
                          className="text-[11px] font-black uppercase tracking-wider ml-1"
                          style={{ color: section.badgeColor }}
                        >
                          {section.title}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-[11px] font-black text-neutral-400">
                      {section.data.length} task{section.data.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                );
              }}
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
            />
          )
        ) : (
          /* COMPLETED FLATLIST */
          groupedTasks.completed.length === 0 ? (
            <View className="py-16 px-6 items-center justify-center bg-white border border-neutral-200/80 rounded-3xl shadow-2xs my-4">
              <View className="w-14 h-14 rounded-2xl bg-neutral-100 items-center justify-center mb-3">
                <CheckCheck size={24} color="#71717A" strokeWidth={2} />
              </View>
              <Text className="text-base font-black text-neutral-900 mb-1 text-center">
                No Completed Tasks Yet
              </Text>
              <Text className="text-xs font-medium text-neutral-500 text-center max-w-xs leading-relaxed">
                When you check off assignments and quizzes, they will be archived here for your academic record.
              </Text>
            </View>
          ) : (
            <FlatList
              data={groupedTasks.completed}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 110 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#18181B" />
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
            />
          )
        )}
      </View>

      {/* 5. Floating Action Button (FAB) */}
      <View className="absolute bottom-6 right-5">
        <Pressable
          onPress={() => router.push('/tasks/create-task')}
          className="flex-row items-center space-x-2 bg-[#FACC15] px-5 py-3.5 rounded-full shadow-lg shadow-yellow-500/25 active:scale-95 active:bg-yellow-400 transition-transform"
          accessibilityLabel="Add New Task"
        >
          <Plus size={18} color="#18181B" strokeWidth={2.5} />
          <Text className="text-neutral-950 font-black text-sm tracking-wide ml-1">
            New Task
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
