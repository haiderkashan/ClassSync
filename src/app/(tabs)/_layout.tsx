import React from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, ListTodo, User } from 'lucide-react-native';
import { useSyncProfile } from '@/hooks/useSyncProfile';

type CustomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Floating pill-shaped Tab Bar component matching the soft, premium design system.
 * Active tab renders as a dark rounded pill with icon and label.
 * Inactive tabs render as subtle, minimalist icon touch targets.
 */
function FloatingTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : 14;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.floatingContainer,
        {
          bottom: bottomInset,
        },
      ]}
    >
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const renderIcon = (color: string) => {
            if (options.tabBarIcon) {
              return options.tabBarIcon({
                focused: isFocused,
                color,
                size: 18,
              });
            }
            if (route.name === 'index') return <Calendar size={18} color={color} strokeWidth={2.2} />;
            if (route.name === 'tasks') return <ListTodo size={18} color={color} strokeWidth={2.2} />;
            if (route.name === 'settings') return <User size={18} color={color} strokeWidth={2.2} />;
            return null;
          };

          if (isFocused) {
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.activePill}
              >
                {renderIcon('#FACC15')}
                <Text style={styles.activeLabel}>
                  {typeof label === 'string' ? label : route.name}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: false }}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.inactiveTarget}
            >
              {renderIcon('#a1a1aa')}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 50,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 9999,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.95)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
      },
      android: {
        elevation: 8,
      },
      default: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b', // neutral-900
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#18181b',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: '0 4px 12px rgba(24, 24, 27, 0.2)',
      },
    }),
  },
  activeLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginLeft: 6,
  },
  inactiveTarget: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Protected Tab Bar layout for the main application.
 * Automatically synchronizes Clerk profile into Supabase in the background.
 */
export default function TabsLayout() {
  // Silent background sync of user profile to Supabase on protected entry
  useSyncProfile();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Calendar size={size || 18} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Deadlines',
          tabBarIcon: ({ color, size }) => <ListTodo size={size || 18} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size || 18} color={color} strokeWidth={2.2} />,
        }}
      />
    </Tabs>
  );
}
