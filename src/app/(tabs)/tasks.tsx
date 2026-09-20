// ============================================================================
// ClassSync Academic Tasks Screen
// File: src/app/(tabs)/tasks.tsx
// Description: Main tasks dashboard featuring Master Segmented Toggle
//              ("Pending" vs "Completed"), horizontal course filter pills,
//              task type filter chips, and Floating Action Button (FAB).
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Plus,
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  ListTodo,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAppStore } from '@/store/useAppStore';
import type { TaskType } from '@/lib/tasks/taskUtils';

export default function TasksScreen() {
  const router = useRouter();
  const { activeSection, courses } = useWorkspaces();
  const { activeCourses, tasks, taskCompletions } = useAppStore();

  // Master Segmented Toggle: 'pending' vs 'completed'
  // Defended against Infinite Scroll Trap (Deficiency 1)
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // Filters
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const enrolledCourses = useMemo(() => {
    return activeCourses.length > 0 ? activeCourses : courses;
  }, [activeCourses, courses]);

  // Derived counts for tabs
  const completedCount = useMemo(() => {
    return tasks.filter((t) => taskCompletions.includes(t.id)).length;
  }, [tasks, taskCompletions]);

  const pendingCount = useMemo(() => {
    return tasks.length - completedCount;
  }, [tasks.length, completedCount]);

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View className="px-5 pt-3 pb-2 bg-white/80 backdrop-blur-md border-b border-neutral-200/50">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-2xl font-black text-neutral-900 tracking-tight">
              Academic Tasks
            </Text>
            <Text className="text-xs font-semibold text-neutral-500 mt-0.5">
              {activeSection?.name || 'My Workspace'}
            </Text>
          </View>

          {/* Quick Add Pill in Header (supplementing FAB) */}
          <Pressable
            onPress={() => router.push('/tasks/create-task')}
            className="flex-row items-center bg-blue-50 border border-blue-200/80 px-3 py-1.5 rounded-full active:bg-blue-100 transition-colors"
          >
            <Plus size={14} color="#2563EB" strokeWidth={2.6} />
            <Text className="text-xs font-bold text-blue-700 ml-1">Add Task</Text>
          </Pressable>
        </View>

        {/* Master Segmented Toggle ("Pending" vs "Completed") */}
        <View className="bg-neutral-100 p-1 rounded-2xl flex-row mb-3">
          {/* Pending Tab */}
          <Pressable
            onPress={() => setActiveTab('pending')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center transition-all ${
              activeTab === 'pending'
                ? 'bg-white shadow-xs'
                : 'active:bg-neutral-200/50'
            }`}
          >
            <Clock
              size={13}
              color={activeTab === 'pending' ? '#0F172A' : '#64748B'}
              strokeWidth={2.2}
            />
            <Text
              className={`text-xs ml-1.5 ${
                activeTab === 'pending'
                  ? 'font-black text-neutral-900'
                  : 'font-semibold text-neutral-500'
              }`}
            >
              Pending
            </Text>
            <View
              className={`ml-1.5 px-1.5 py-0.2 rounded-full ${
                activeTab === 'pending' ? 'bg-neutral-900' : 'bg-neutral-200'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  activeTab === 'pending' ? 'text-white' : 'text-neutral-600'
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
                ? 'bg-white shadow-xs'
                : 'active:bg-neutral-200/50'
            }`}
          >
            <CheckCircle2
              size={13}
              color={activeTab === 'completed' ? '#10B981' : '#64748B'}
              strokeWidth={2.2}
            />
            <Text
              className={`text-xs ml-1.5 ${
                activeTab === 'completed'
                  ? 'font-black text-neutral-900'
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

      {/* Main Content Placeholder for Task 3 SectionList Integration */}
      <View className="flex-1 px-5 pt-4 justify-center items-center">
        <View className="w-16 h-16 rounded-3xl bg-neutral-100 items-center justify-center mb-3">
          <ListTodo size={28} color="#64748B" strokeWidth={2} />
        </View>
        <Text className="text-base font-bold text-neutral-800 mb-1">
          {activeTab === 'pending' ? 'Pending Tasks View' : 'Completed Tasks Archive'}
        </Text>
        <Text className="text-xs text-neutral-500 text-center max-w-xs leading-relaxed">
          {activeTab === 'pending'
            ? 'SectionList with Overdue, Due Soon (rolling 7 days), and Upcoming will render here.'
            : 'FlatList with archived completed tasks will render here.'}
        </Text>
      </View>

      {/* Floating Action Button (FAB) */}
      <View className="absolute bottom-6 right-5">
        <Pressable
          onPress={() => router.push('/tasks/create-task')}
          className="bg-neutral-900 px-5 py-3.5 rounded-full shadow-lg shadow-neutral-900/30 flex-row items-center active:bg-neutral-800 transition-transform active:scale-95"
        >
          <Plus size={18} color="#FFFFFF" strokeWidth={2.6} />
          <Text className="text-xs font-black text-white ml-2">New Task</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
