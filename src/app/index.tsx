import { View, Text } from 'react-native';
import { Calendar, CheckCircle2, ShieldCheck, Database, UserCheck } from 'lucide-react-native';
import { useAuth } from '@clerk/clerk-expo';
import { env } from '@/lib/env';
import { useAppStore } from '@/store/useAppStore';

export default function HomeScreen() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const isHydrated = useAppStore((state) => state.isHydrated);

  return (
    <View className="flex-1 items-center justify-center bg-brand-50 p-6">
      <View className="w-16 h-16 rounded-2xl bg-brand-600 items-center justify-center mb-4 shadow-lg">
        <Calendar size={32} color="#ffffff" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 mb-1">ClassSync</Text>
      <Text className="text-sm text-gray-600 text-center mb-6">
        Frictionless, Peer-Driven Academic Hub
      </Text>

      <View className="w-full max-w-xs space-y-2.5">
        <View className="flex-row items-center bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm">
          <CheckCircle2 size={18} color="#10b981" />
          <Text className="ml-2.5 text-xs font-medium text-gray-700">
            NativeWind & Tailwind v3.4 Active
          </Text>
        </View>

        <View className="flex-row items-center bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm mt-2">
          <ShieldCheck size={18} color="#6366f1" />
          <Text className="ml-2.5 text-xs font-medium text-gray-700">
            Env: {env.EXPO_PUBLIC_APP_ENV} (Zod Verified)
          </Text>
        </View>

        <View className="flex-row items-center bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm mt-2">
          <Database size={18} color="#3b82f6" />
          <Text className="ml-2.5 text-xs font-medium text-gray-700">
            Store: {isHydrated ? 'Zustand State Hydrated' : 'Not Hydrated'}
          </Text>
        </View>

        <View className="flex-row items-center bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm mt-2">
          <UserCheck size={18} color="#8b5cf6" />
          <Text className="ml-2.5 text-xs font-medium text-gray-700">
            Auth: {!isLoaded ? 'Initializing...' : isSignedIn ? `User: ${userId?.slice(0, 10)}...` : 'Clerk Context Active'}
          </Text>
        </View>
      </View>
    </View>
  );
}
