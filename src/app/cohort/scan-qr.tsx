import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {
  X,
  Camera,
  AlertCircle,
  QrCode,
  ArrowRight,
  Sparkles,
  Settings,
} from 'lucide-react-native';
import { useAppStore } from '@/store/useAppStore';
import { parseJoinCodeFromUrl } from '@/lib/scanner/deepLinkUtils';

export default function ScanQrModal() {
  const router = useRouter();
  const setPendingJoinCode = useAppStore((state) => state.setPendingJoinCode);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Web fallback manual input state
  const [webManualCode, setWebManualCode] = useState('');

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleManualRedirect = (codeToPass?: string) => {
    const targetCode = (codeToPass || webManualCode).trim().toUpperCase();
    if (targetCode) {
      setPendingJoinCode(targetCode);
      router.replace({
        pathname: '/join-section',
        params: { code: targetCode },
      });
    } else {
      router.replace('/join-section');
    }
  };

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);

    // Provide immediate tactile haptic feedback on scan
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics safe fallback
      }
    }

    const rawData = result.data;
    console.log('📷 [Scanner] Barcode scanned data:', rawData);
    const joinCode = parseJoinCodeFromUrl(rawData);

    if (joinCode) {
      setPendingJoinCode(joinCode);
      router.replace({
        pathname: '/join-section',
        params: { code: joinCode },
      });
    } else {
      setErrorMessage('Unrecognized QR code. Please scan a valid ClassSync join code.');
      setTimeout(() => {
        setErrorMessage(null);
        setScanned(false);
      }, 2500);
    }
  };

  // 1. Strict Web Platform Fallback UI
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 items-center justify-center p-6">
        <View className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl items-center">
          <View className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center mb-4">
            <QrCode size={28} color="#818cf8" />
          </View>

          <Text className="text-xl font-black text-white text-center mb-1.5">
            Web QR Code Scanner
          </Text>
          <Text className="text-xs text-neutral-400 text-center mb-6 leading-relaxed">
            Live camera barcode scanning is optimized for native mobile devices.
            On web, you can enter or paste the 6-character cohort code directly.
          </Text>

          <View className="w-full mb-4">
            <TextInput
              value={webManualCode}
              onChangeText={(text) => setWebManualCode(text.toUpperCase().slice(0, 6))}
              placeholder="e.g. BSSE26"
              placeholderTextColor="#71717a"
              autoCapitalize="characters"
              className="w-full h-14 bg-neutral-950 border border-neutral-800 rounded-2xl px-4 text-center font-mono font-bold text-xl text-white tracking-widest"
            />
          </View>

          <Pressable
            onPress={() => handleManualRedirect(webManualCode)}
            className="w-full py-4 bg-indigo-600 rounded-2xl flex-row items-center justify-center active:bg-indigo-700 shadow-md shadow-indigo-950"
          >
            <Text className="text-xs font-bold text-white mr-1.5">
              {webManualCode.trim().length === 6 ? 'Join Cohort with Code' : 'Go to Manual Join Screen'}
            </Text>
            <ArrowRight size={14} color="#ffffff" />
          </Pressable>

          <Pressable
            onPress={handleClose}
            className="mt-4 py-2 px-4 rounded-xl active:bg-neutral-800"
          >
            <Text className="text-xs font-semibold text-neutral-400">Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Loading State while Permissions resolve
  if (!permission) {
    return (
      <View className="flex-1 bg-neutral-950 items-center justify-center p-6">
        <ActivityIndicator size="large" color="#818cf8" />
        <Text className="text-xs font-medium text-neutral-400 mt-4">
          Initializing Camera...
        </Text>
      </View>
    );
  }

  // 3. Permission Denied / Prompt UI
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-950 justify-between p-6">
        <View className="flex-row justify-end">
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 items-center justify-center active:bg-neutral-800"
          >
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        <View className="items-center px-4">
          <View className="w-16 h-16 rounded-3xl bg-neutral-900 border border-neutral-800 items-center justify-center mb-5">
            <Camera size={32} color="#818cf8" />
          </View>

          <Text className="text-2xl font-black text-white text-center mb-2">
            Camera Permission Required
          </Text>
          <Text className="text-xs text-neutral-400 text-center mb-8 leading-relaxed max-w-xs">
            ClassSync uses your camera to instantly scan Presenter QR codes and onboard you into your cohort timetable.
          </Text>

          {permission.canAskAgain ? (
            <Pressable
              onPress={requestPermission}
              className="w-full py-4 bg-indigo-600 rounded-2xl flex-row items-center justify-center shadow-lg shadow-indigo-950 active:bg-indigo-700 mb-3"
            >
              <Camera size={16} color="#ffffff" />
              <Text className="text-xs font-bold text-white ml-2">Grant Camera Access</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => Linking.openSettings().catch(() => {})}
              className="w-full py-4 bg-neutral-800 border border-neutral-700 rounded-2xl flex-row items-center justify-center shadow-lg active:bg-neutral-700 mb-3"
            >
              <Settings size={16} color="#ffffff" />
              <Text className="text-xs font-bold text-white ml-2">Open System Settings</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => handleManualRedirect()}
            className="py-3 px-4 active:bg-neutral-900 rounded-xl"
          >
            <Text className="text-xs font-bold text-indigo-400">
              Enter 6-Character Code Manually
            </Text>
          </Pressable>
        </View>

        <View />
      </SafeAreaView>
    );
  }

  // 4. Active Live Camera Scanner Viewport
  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Top Header Overlay */}
      <SafeAreaView className="flex-1 justify-between">
        <View className="px-6 py-4 flex-row items-center justify-between">
          <View className="flex-row items-center space-x-1.5">
            <View className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <Text className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Scan Cohort QR
            </Text>
          </View>

          <Pressable
            onPress={handleClose}
            hitSlop={12}
            className="w-10 h-10 rounded-full bg-black/60 border border-white/20 items-center justify-center active:bg-black/80"
          >
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        {/* Viewport Reticle Box */}
        <View className="items-center justify-center">
          <View className="w-64 h-64 border-2 border-indigo-400 rounded-3xl relative items-center justify-center shadow-2xl">
            {/* Corner Accent Brackets */}
            <View className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl -mt-1 -ml-1" />
            <View className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl -mt-1 -mr-1" />
            <View className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl -mb-1 -ml-1" />
            <View className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl -mb-1 -mr-1" />

            {errorMessage ? (
              <View className="bg-rose-950/90 border border-rose-500/80 px-4 py-2.5 rounded-2xl flex-row items-center space-x-2">
                <AlertCircle size={16} color="#fb7185" />
                <Text className="text-xs font-bold text-rose-300 ml-1.5 text-center">
                  Invalid QR Code
                </Text>
              </View>
            ) : (
              <View className="bg-black/40 px-3 py-1.5 rounded-full flex-row items-center space-x-1">
                <Sparkles size={12} color="#a5b4fc" />
                <Text className="text-[11px] font-bold text-white/90">
                  Align QR in frame
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Control Dock */}
        <View className="p-6 bg-black/70 border-t border-white/10 backdrop-blur-md">
          <Text className="text-xs text-neutral-300 text-center mb-4 leading-relaxed">
            Point camera at the Presenter QR Code on screen or from a classmate.
          </Text>

          <Pressable
            onPress={() => handleManualRedirect()}
            className="w-full py-3.5 bg-neutral-900/90 border border-white/20 rounded-2xl flex-row items-center justify-center active:bg-neutral-800"
          >
            <Text className="text-xs font-bold text-white">
              Enter Code Manually
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
