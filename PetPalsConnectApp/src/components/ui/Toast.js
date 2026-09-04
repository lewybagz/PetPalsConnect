import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, Animated, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import Text from "./Text";

/**
 * Non-blocking feedback.
 *
 * `Alert.alert` was the app's primary way of telling anybody anything - 157
 * calls across 48 files, for successes as often as failures. Every one is a
 * modal that stops the app, demands a tap, and looks like an operating-system
 * error rather than part of PetPals. "Playdate scheduled" does not need to
 * interrupt someone.
 *
 * Alerts keep the job they are good at: a destructive confirmation with a real
 * choice in it. Everything else comes through here.
 *
 * The toast announces itself to screen readers rather than stealing focus, so
 * it stays non-blocking for everybody rather than only for sighted users.
 */

/**
 * The default has to carry *every* method the provider does. A screen rendered
 * without the host - which is how the tests render them - calls `toast.success`
 * as readily as `toast.show`, and a missing one is a TypeError inside a submit
 * handler rather than a silent no-op.
 */
const noop = () => {};
const ToastContext = createContext({
  show: noop,
  dismiss: noop,
  success: noop,
  error: noop,
  warning: noop,
});

const TONES = {
  info: { bg: "bg-surfaceAlt", border: "border-border", icon: "information-circle", token: "text" },
  success: { bg: "bg-successSoft", border: "border-success", icon: "checkmark-circle", token: "success" },
  error: { bg: "bg-dangerSoft", border: "border-danger", icon: "alert-circle", token: "danger" },
  warning: { bg: "bg-warningSoft", border: "border-warning", icon: "warning", token: "warning" },
};

const DEFAULT_MS = 3200;

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (message, options = {}) => {
      if (!message) return;
      if (timer.current) clearTimeout(timer.current);

      const next = {
        id: Date.now(),
        message,
        tone: TONES[options.tone] ? options.tone : "info",
        actionLabel: options.actionLabel,
        onAction: options.onAction,
      };
      setToast(next);

      // A toast that only appears visually is not feedback for everyone.
      AccessibilityInfo.announceForAccessibility?.(message);

      timer.current = setTimeout(() => setToast(null), options.duration ?? DEFAULT_MS);
    },
    []
  );

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show(message, { ...options, tone: "success" }),
      error: (message, options) => show(message, { ...options, tone: "error" }),
      warning: (message, options) => show(message, { ...options, tone: "warning" }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

const ToastHost = ({ toast, onDismiss }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  // `useRef(new Animated.Value(0)).current` reads a ref during render and
  // builds a fresh value on every one just to discard it.
  const slide = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: toast ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [toast, slide]);

  if (!toast) return null;

  const look = TONES[toast.tone];

  return (
    <Animated.View
      // Sits above the tab bar's own inset so it never lands under it.
      style={[
        tailwind("absolute left-lg right-lg"),
        {
          bottom: insets.bottom + 72,
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        testID="toast"
        accessibilityLiveRegion="polite"
        style={tailwind(
          `flex-row items-center rounded-card border p-md ${look.bg} ${look.border}`
        )}
      >
        <Ionicons name={look.icon} size={20} color={tokens[look.token]} />

        <Text variant="label" weight="400" style={tailwind("flex-1 ml-sm")}>
          {toast.message}
        </Text>

        {toast.actionLabel && toast.onAction ? (
          <Pressable
            testID="toast-action"
            accessibilityRole="button"
            onPress={() => {
              toast.onAction();
              onDismiss();
            }}
            style={tailwind("ml-sm px-sm py-xs")}
          >
            <Text variant="label" tone="primary">
              {toast.actionLabel}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            testID="toast-dismiss"
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onDismiss}
            style={tailwind("ml-sm p-xs")}
          >
            <Ionicons name="close" size={18} color={tokens.textMuted} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

/**
 * `const toast = useToast()` then `toast.success("Playdate scheduled")`.
 *
 * Safe outside the provider: the default context is a no-op, so a component
 * rendered in isolation by a test does not have to mount the host.
 */
export const useToast = () => useContext(ToastContext);

export default ToastProvider;
