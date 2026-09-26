import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Custom hook to handle Android hardware back press for open modals or sheets,
 * ensuring users can dismiss modals via the back gesture or hardware back button
 * without exiting the application or popping multiple parent navigation routes.
 */
export function useModalBackHandler(isOpen: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !isOpen) {
      return;
    }

    const backAction = () => {
      onDismiss();
      return true; // Consume event to prevent app exit or parent route popping
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [isOpen, onDismiss]);
}
