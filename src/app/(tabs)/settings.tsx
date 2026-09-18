import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { LogOut, Mail, ShieldCheck, User as UserIcon, School } from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('[Settings] Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Student';

  const email = user?.primaryEmailAddress?.emailAddress || 'No email attached';
  const avatarUrl = user?.imageUrl;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-5 pt-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-black text-gray-900 tracking-tight">
            Account & Settings
          </Text>
          <Text className="text-xs font-medium text-gray-500 mt-0.5">
            Manage your student profile, academic sync, and sessions
          </Text>
        </View>

        {/* Profile Card */}
        <View className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm mb-5">
          <View className="flex-row items-center">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="w-16 h-16 rounded-2xl bg-gray-100"
              />
            ) : (
              <View className="w-16 h-16 rounded-2xl bg-brand-100 items-center justify-center">
                <UserIcon size={30} color="#4f46e5" />
              </View>
            )}

            <View className="ml-4 flex-1">
              <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
                {displayName}
              </Text>
              <View className="flex-row items-center mt-1">
                <Mail size={13} color="#6b7280" />
                <Text className="text-xs text-gray-500 ml-1.5 flex-1" numberOfLines={1}>
                  {email}
                </Text>
              </View>
            </View>
          </View>

          {/* Verification Chips */}
          <View className="flex-row items-center justify-between mt-5 pt-4 border-t border-gray-100">
            <View className="flex-row items-center">
              <ShieldCheck size={16} color="#10b981" />
              <Text className="text-xs font-semibold text-emerald-700 ml-1.5">
                Clerk & Supabase Synced
              </Text>
            </View>
            <Text className="text-[11px] font-mono text-gray-400">
              ID: {user?.id ? `${user.id.slice(0, 10)}...` : 'Active'}
            </Text>
          </View>
        </View>

        {/* Academic Cohort Workspace Card (Preview for Phase 2) */}
        <View className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm mb-6">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 rounded-xl bg-brand-50 items-center justify-center mr-2.5">
              <School size={18} color="#4f46e5" />
            </View>
            <Text className="text-sm font-bold text-gray-900">
              Active Cohort Workspace
            </Text>
          </View>
          <Text className="text-xs text-gray-500 leading-4">
            You are not enrolled in an active section yet. In Phase 2, you will be able to create a cohort or join with a 7-digit code.
          </Text>
        </View>

        {/* Sign Out Button */}
        <Pressable
          onPress={handleSignOut}
          disabled={isSigningOut || !isLoaded}
          className="w-full flex-row items-center justify-center py-3.5 px-4 bg-rose-50 border border-rose-200 rounded-2xl active:bg-rose-100"
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color="#e11d48" />
          ) : (
            <>
              <LogOut size={18} color="#e11d48" />
              <Text className="text-sm font-semibold text-rose-600 ml-2.5">
                Sign Out of ClassSync
              </Text>
            </>
          )}
        </Pressable>

        {/* Build Metadata */}
        <Text className="text-[11px] text-gray-400 text-center mt-6 mb-8">
          ClassSync v1.0.0 • Mobile Architecture Phase 1
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
