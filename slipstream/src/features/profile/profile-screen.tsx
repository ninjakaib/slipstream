import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SymbolView } from "expo-symbols";

import { useAuth } from "@/contexts/auth-context";
import { getMyProfile, listCars } from "@/lib/api/sdk.gen";
import type { CarResponse, UserProfile } from "@/lib/api/types.gen";

export default function ProfileScreen() {
  const { session, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cars, setCars] = useState<CarResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [profileRes, carsRes] = await Promise.all([
        getMyProfile(),
        listCars(),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (carsRes.data) setCars(carsRes.data as CarResponse[]);
      setLoading(false);
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      {/* Avatar + Name */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <SymbolView name="person.crop.circle.fill" tintColor="#8E8E93" size={64} />
        </View>
        <Text style={styles.displayName}>
          {profile?.display_name || profile?.username || "Driver"}
        </Text>
        <Text style={styles.username}>@{profile?.username}</Text>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="eye.fill"
            label="Visibility"
            value={profile?.visibility ?? "on"}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="location.circle.fill"
            label="Discovery Radius"
            value={`${profile?.discovery_radius_miles ?? 25} mi`}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="speedometer"
            label="Speed Unit"
            value={profile?.speed_unit === "kph" ? "km/h" : "mph"}
          />
        </View>
      </View>

      {/* Garage Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Garage</Text>
        <View style={styles.card}>
          {cars.length === 0 ? (
            <Text style={styles.emptyText}>No cars added yet</Text>
          ) : (
            cars.map((car, i) => (
              <View key={car.id}>
                {i > 0 && <View style={styles.separator} />}
                <View style={styles.carRow}>
                  <SymbolView name="car.fill" tintColor="#57C7FF" size={20} />
                  <View style={styles.carInfo}>
                    <Text style={styles.carName}>
                      {car.year} {car.make} {car.model}
                    </Text>
                    {car.trim && (
                      <Text style={styles.carTrim}>{car.trim}</Text>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="envelope.fill"
            label="Email"
            value={profile?.email || "Not set"}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="person.text.rectangle.fill"
            label="User ID"
            value={session?.userId.slice(0, 8) + "..."}
          />
        </View>
      </View>

      {/* Logout */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <SymbolView name="rectangle.portrait.and.arrow.right" tintColor="#FF3B30" size={18} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingsRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.settingsRow}>
      <SymbolView name={icon as any} tintColor="#57C7FF" size={18} />
      <Text style={styles.settingsLabel}>{label}</Text>
      <Text style={styles.settingsValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatar: {
    marginBottom: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  username: {
    fontSize: 15,
    color: "#8E8E93",
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#38383A",
    marginVertical: 10,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
  },
  settingsValue: {
    fontSize: 15,
    color: "#8E8E93",
  },
  carRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  carInfo: {
    flex: 1,
  },
  carName: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  carTrim: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    paddingVertical: 8,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3B30",
  },
});
