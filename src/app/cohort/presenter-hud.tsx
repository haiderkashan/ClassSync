import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import {
  X,
  Copy,
  Check,
  Share2,
  Users,
  Hash,
  Sparkles,
  Maximize2,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useSupabase } from '@/hooks/useSupabase';
import { setupPresenterDisplayMode } from '@/lib/presenter/displayService';

export default function PresenterHudModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sectionId?: string }>();
  const { sections, activeSection } = useWorkspaces();
  const { width, height } = useWindowDimensions();

  // Find target section (param takes priority over active workspace)
  const section = useMemo(() => {
    if (params.sectionId) {
      return sections.find((s) => s.id === params.sectionId) || activeSection;
    }
    return activeSection;
  }, [params.sectionId, sections, activeSection]);

  const joinCode = section?.join_code || '------';
  const joinUrl = `https://classsync.app/join?code=${joinCode}`;

  const supabase = useSupabase();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [isCountLoading, setIsCountLoading] = useState(true);
  const [recentlyJoined, setRecentlyJoined] = useState(false);

  // Dynamic QR sizing tailored for auditorium & projection visibility
  const qrSize = useMemo(() => {
    const minDim = Math.min(width, height);
    return Math.max(220, Math.min(minDim * 0.65, 320));
  }, [width, height]);

  // Fetch initial student count & listen for live Supabase Realtime INSERTs
  useEffect(() => {
    if (!section?.id) return;

    let isMounted = true;

    const fetchInitialCount = async () => {
      try {
        const { count, error } = await supabase
          .from('section_members')
          .select('*', { count: 'exact', head: true })
          .eq('section_id', section.id);

        if (!error && typeof count === 'number' && isMounted) {
          setEnrolledCount(count);
        }
      } catch (err) {
        console.warn('⚠️ [PresenterHUD] Failed to fetch member count:', err);
      } finally {
        if (isMounted) setIsCountLoading(false);
      }
    };

    fetchInitialCount();

    const channelName = `presenter_members_${section.id}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'section_members',
          filter: `section_id=eq.${section.id}`,
        },
        (payload) => {
          console.log('🎉 [PresenterHUD] Live student onboarded via Realtime:', payload.new);
          if (isMounted) {
            setEnrolledCount((prev) => (prev !== null ? prev + 1 : 1));
            setRecentlyJoined(true);
            setTimeout(() => {
              if (isMounted) setRecentlyJoined(false);
            }, 3500);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [section?.id, supabase]);

  // Wire hardware display locks: max brightness, portrait lock, keep-awake
  useEffect(() => {
    let cleanupFn: (() => Promise<void>) | null = null;
    let isMounted = true;

    setupPresenterDisplayMode()
      .then((cleanup) => {
        if (isMounted) {
          cleanupFn = cleanup;
        } else {
          cleanup();
        }
      })
      .catch((err) => {
        console.warn('⚠️ [PresenterHUD] Display mode initialization error:', err);
      });

    return () => {
      isMounted = false;
      if (cleanupFn) {
        cleanupFn().catch((err) => {
          console.warn('⚠️ [PresenterHUD] Display mode cleanup error:', err);
        });
      }
    };
  }, []);

  const handleCopyCode = async () => {
    if (!section?.join_code) return;
    await Clipboard.setStringAsync(section.join_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(joinUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        title: `Join ${section?.name || 'ClassSync Cohort'}`,
        message: `Join ${section?.name || 'our class'} on ClassSync! Enter join code: ${joinCode} or tap the link: ${joinUrl}`,
        url: joinUrl,
      });
    } catch (err) {
      console.warn('⚠️ [PresenterHUD] Share failed:', err);
    }
  };

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-950 justify-between">
      {/* Top HUD Navigation Bar */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-neutral-800/80">
        <View className="flex-1 mr-4">
          <View className="flex-row items-center space-x-1.5">
            <View className="w-2 h-2 rounded-full bg-emerald-400" />
            <Text className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
              Presenter Mode
            </Text>
          </View>
          <Text className="text-lg font-black text-white tracking-tight mt-0.5" numberOfLines={1}>
            {section?.name || 'Class Cohort'}
          </Text>
          {section?.institution_tag && (
            <Text className="text-xs text-neutral-400" numberOfLines={1}>
              {section.institution_tag}
            </Text>
          )}
        </View>

        <Pressable
          onPress={handleClose}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center active:bg-neutral-800"
        >
          <X size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* Live Realtime Enrolled Student Counter Pill */}
      <View className="px-6 pt-3 items-center">
        <View
          className={`px-4 py-2 rounded-full border flex-row items-center space-x-2 shadow-lg ${
            recentlyJoined
              ? 'bg-emerald-950/90 border-emerald-500/80'
              : 'bg-neutral-900/90 border-neutral-800'
          }`}
        >
          <View
            className={`w-2.5 h-2.5 rounded-full mr-2 ${
              recentlyJoined ? 'bg-emerald-400' : 'bg-emerald-500'
            }`}
          />
          <Users size={14} color={recentlyJoined ? '#34d399' : '#a1a1aa'} />
          <Text className="text-xs font-bold text-neutral-300 ml-1">
            Live Enrolled:
          </Text>
          <Text className="text-xs font-black text-white ml-1">
            {isCountLoading ? '...' : `${enrolledCount ?? 0} ${enrolledCount === 1 ? 'Student' : 'Students'}`}
          </Text>
          {recentlyJoined && (
            <View className="ml-2 bg-emerald-500/20 px-2 py-0.5 rounded-full flex-row items-center">
              <Sparkles size={10} color="#34d399" />
              <Text className="text-[10px] font-black text-emerald-400 ml-1">+1 Joined!</Text>
            </View>
          )}
        </View>
      </View>

      {/* Main High-Contrast Projector Canvas */}
      <View className="flex-1 items-center justify-center px-6 py-4">
        {/* Crisp White QR Shield */}
        <View className="p-6 bg-white rounded-3xl shadow-2xl items-center justify-center border-4 border-neutral-800">
          <QRCode
            value={joinUrl}
            size={qrSize}
            ecl="H"
            backgroundColor="#ffffff"
            color="#09090b"
          />
          <View className="mt-3 flex-row items-center space-x-1">
            <Sparkles size={12} color="#71717a" />
            <Text className="text-[11px] font-semibold text-neutral-500">
              Scan with mobile camera to join
            </Text>
          </View>
        </View>

        {/* Massive 6-Character Join Code Badge */}
        <View className="mt-6 w-full max-w-sm items-center">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
            Cohort Access Code
          </Text>
          <Pressable
            onPress={handleCopyCode}
            className="w-full py-4 px-6 bg-neutral-900 border-2 border-neutral-800 rounded-3xl flex-row items-center justify-center space-x-3 active:border-indigo-500 active:bg-neutral-850"
          >
            <Hash size={24} color="#818cf8" />
            <Text className="text-4xl font-black font-mono tracking-widest text-white ml-2">
              {joinCode}
            </Text>
            <View className="ml-3 pl-3 border-l border-neutral-800">
              {copiedCode ? (
                <Check size={20} color="#34d399" />
              ) : (
                <Copy size={20} color="#a1a1aa" />
              )}
            </View>
          </Pressable>
          <Text className="text-[11px] text-neutral-500 mt-2 text-center">
            {copiedCode ? 'Copied code to clipboard!' : 'Students can enter this code in ClassSync'}
          </Text>
        </View>
      </View>

      {/* Bottom Action Dock */}
      <View className="px-6 py-5 border-t border-neutral-900 bg-neutral-950/80">
        <View className="flex-row items-center justify-center space-x-3">
          <Pressable
            onPress={handleCopyLink}
            className="flex-1 py-3.5 px-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex-row items-center justify-center space-x-2 active:bg-neutral-800"
          >
            {copiedUrl ? (
              <Check size={16} color="#34d399" />
            ) : (
              <Copy size={16} color="#ffffff" />
            )}
            <Text className="text-xs font-bold text-white ml-2">
              {copiedUrl ? 'Link Copied' : 'Copy Join Link'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleNativeShare}
            className="flex-1 py-3.5 px-4 bg-indigo-600 rounded-2xl flex-row items-center justify-center space-x-2 active:bg-indigo-700 shadow-md shadow-indigo-950"
          >
            <Share2 size={16} color="#ffffff" />
            <Text className="text-xs font-bold text-white ml-2">Share Invite</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
