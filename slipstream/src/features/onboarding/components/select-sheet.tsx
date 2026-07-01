/**
 * SelectSheet — a simple bottom-sheet picker (title, optional search, scrollable
 * option list). Used for the Year and Make selectors on the vehicle step.
 */
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ONBOARDING_COLORS } from "@/features/onboarding/components/scaffold";

export interface SelectOption {
  label: string;
  value: string;
  /** Optional pinned row rendered with an accent (e.g. "Custom Make"). */
  accent?: boolean;
}

interface SelectSheetProps {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedValue?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function SelectSheet({
  visible,
  title,
  options,
  selectedValue,
  searchable = false,
  searchPlaceholder = "Search",
  onSelect,
  onClose,
}: SelectSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdropRoot}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={10} style={styles.closeBtn}>
              <SymbolView
                name="xmark"
                size={14}
                tintColor="#FFFFFF"
                weight="bold"
                fallback={null}
              />
            </Pressable>
          </View>

          {searchable && (
            <View style={styles.search}>
              <SymbolView
                name="magnifyingglass"
                size={16}
                tintColor={ONBOARDING_COLORS.textMuted}
                fallback={null}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={searchPlaceholder}
                placeholderTextColor={ONBOARDING_COLORS.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const selected = item.value === selectedValue;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.value);
                    handleClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    selected && styles.rowSelected,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      item.accent && styles.rowLabelAccent,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selected && (
                    <SymbolView
                      name="checkmark"
                      size={16}
                      tintColor="#FFFFFF"
                      weight="bold"
                      fallback={null}
                    />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>No matches</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  panel: {
    maxHeight: "75%",
    backgroundColor: "#161618",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 16 },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: 8, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rowSelected: { borderColor: "rgba(255,255,255,0.4)" },
  rowPressed: { opacity: 0.7 },
  rowLabel: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  rowLabelAccent: { color: "#2D8CFF" },
  empty: { color: ONBOARDING_COLORS.textMuted, textAlign: "center", paddingVertical: 24 },
});
