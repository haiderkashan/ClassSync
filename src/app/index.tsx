import { View, Text } from 'react-native';
import { Calendar, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import { env } from '@/lib/env';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-50 p-6">
      <View className="w-16 h-16 rounded-2xl bg-brand-600 items-center justify-center mb-4 shadow-lg">
        <Calendar size={32} color="#ffffff" />
      </View>
      <Text className="text-2xl font-bold text-gray-900 mb-2">ClassSync</Text>
      <Text className="text-sm text-gray-600 text-center mb-6">
        Frictionless, Peer-Driven Academic Hub
      </Text>
      <View className="space-y-2">
        <View className="flex-row items-center bg-white px-4 py-2.5 rounded-full border border-gray-200 shadow-sm">
          <CheckCircle2 size={18} color="#10b981" />
          <Text className="ml-2 text-xs font-semibold text-gray-700">
            NativeWind & Tailwind v3.4 Active
          </Text>
        </View>
        <View className="flex-row items-center bg-white px-4 py-2.5 rounded-full border border-gray-200 shadow-sm mt-2">
          <ShieldCheck size={18} color="#6366f1" />
          <Text className="ml-2 text-xs font-semibold text-gray-700">
            Env: {env.EXPO_PUBLIC_APP_ENV} (Zod Verified)
          </Text>
        </View>
      </View>
    </View>
  );
}
