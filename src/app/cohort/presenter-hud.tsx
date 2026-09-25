// ============================================================================
// ClassSync Presenter QR HUD (Projector Mode)
// File: src/app/cohort/presenter-hud.tsx
// Description: Overhauled full-screen projection HUD generated via Stitch UI.
//              Features giant scannable QR container, segmented 6-character
//              join code cards, live student Realtime counter, and hardware
//              display lock (brightness, keep-awake, portrait orientation).
// ============================================================================

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
  Sparkles,
  Cast,
  Maximize2,
  ShieldCheck,
} from 'lucide-react-native';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useSupabase } from '@/hooks/useSupabase';
import { setupPresenterDisplayMode } from '@/lib/presenter/displayService';

export default function PresenterHudModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sectionId?: string }>();
  const { sections, activeSection } = useWorkspaces();
  const { width, height } = useWindowDimensions();

  // Target section (parameter takes precedence over active section)
  const section = useMemo(() => {
    if (params.sectionId) {
      return sections.find((s) => s.id === params.sectionId) || activeSection;
    }
    return activeSection;
  }, [params.sectionId, sections, activeSection]);

  const joinCode = (section?.join_code || '------').toUpperCase();
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
    return Math.max(220, Math.min(minDim * 0.62, 320));
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

  const joinCodeChars = joinCode.split('');

  return (
    <SafeAreaView className="flex-1 bg-[#131315] justify-between">
      {/* 1. Top HUD Navigation Bar */}
      <View className="px-6 py-3.5 flex-row items-center justify-between border-b border-neutral-800/80 bg-[#131315]">
        <View className="flex-1 mr-4">
          <View className="flex-row items-center space-x-2">
            <View className="w-2.5 h-2.5 rounded-full bg-[#FACC15]" />
            <Text className="text-[11px] font-black uppercase tracking-widest text-[#FACC15]">
              Presenter Projection HUD
            </Text>
          </View>
          <Text className="text-xl font-black text-white tracking-tight mt-0.5" numberOfLines={1}>
            {section?.name || 'Class Cohort'}
          </Text>
          {section?.institution_tag && (
            <Text className="text-xs text-neutral-400 font-medium" numberOfLines={1}>
              {section.institution_tag}
            </Text>
          )}
        </View>

        <Pressable
          onPress={handleClose}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center active:bg-neutral-800"
          accessibilityLabel="Close Presenter HUD"
        >
          <X size={20} color="#ffffff" />
        </Pressable>
      </View>

      {/* 2. Live Realtime Enrolled Student Counter Pill */}
      <View className="px-6 pt-3 items-center">
        <View
          className={`px-4 py-2 rounded-full border flex-row items-center space-x-2 shadow-lg ${
            recentlyJoined
              ? 'bg-emerald-950/90 border-emerald-500/80'
              : 'bg-[#18181B] border-neutral-800'
          }`}
        >
          <View
            className={`w-2.5 h-2.5 rounded-full ${
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

      {/* 3. Main Projector Canvas */}
      <View className="flex-1 items-center justify-center px-6 py-2">
        {/* Scannable White QR Shield Card */}
        <View className="p-6 bg-white rounded-3xl shadow-2xl items-center justify-center border-4 border-[#FACC15]/40">
          <QRCode
            value={joinUrl}
            size={qrSize}
            ecl="H"
            backgroundColor="#ffffff"
            color="#09090b"
          />
          <View className="mt-3 flex-row items-center space-x-1">
            <Sparkles size={12} color="#71717A" />
            <Text className="text-[11px] font-bold text-neutral-500 ml-1">
              Point phone camera to join
            </Text>
          </View>
        </View>

        {/* 4. Giant 6-Character Join Code Display */}
        <View className="mt-5 w-full max-w-sm items-center">
          <Text className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">
            6-DIGIT COHORT ACCESS CODE
          </Text>

          <Pressable
            onPress={handleCopyCode}
            className="flex-row items-center justify-center space-x-2 p-1.5 active:scale-98 transition-transform"
          >
            {joinCodeChars.map((char, index) => (
              <View
                key={index}
                className="w-12 h-14 rounded-2xl bg-[#18181B] border-2 border-[#FACC15]/70 items-center justify-center shadow-lg"
              >
                <Text className="text-2xl font-black font-mono text-[#FACC15]">
                  {char}
                </Text>
              </View>
            ))}
          </Pressable>

          <Pressable
            onPress={handleCopyCode}
            className="flex-row items-center space-x-1.5 mt-2 bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-full"
          >
            {copiedCode ? (
              <Check size={14} color="#34D399" />
            ) : (
              <Copy size={14} color="#FACC15" />
            )}
            <Text className="text-xs font-bold text-neutral-300 ml-1">
              {copiedCode ? 'Copied to Clipboard!' : 'Tap Code to Copy'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 5. Bottom Action Dock */}
      <View className="px-6 py-4 border-t border-neutral-800/80 bg-[#131315]">
        <View className="flex-row items-center justify-center space-x-3">
          <Pressable
            onPress={handleCopyLink}
            className="flex-1 py-3.5 px-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex-row items-center justify-center space-x-2 active:bg-neutral-800"
          >
            {copiedUrl ? (
              <Check size={16} color="#34D399" />
            ) : (
              <Copy size={16} color="#ffffff" />
            )}
            <Text className="text-xs font-bold text-white ml-1.5">
              {copiedUrl ? 'Link Copied' : 'Copy Join Link'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleNativeShare}
            className="flex-1 py-3.5 px-4 bg-[#FACC15] rounded-2xl flex-row items-center justify-center space-x-2 active:bg-yellow-400 shadow-md"
          >
            <Share2 size={16} color="#18181B" strokeWidth={2.4} />
            <Text className="text-xs font-black text-neutral-950 ml-1.5">
              Share Invite
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
