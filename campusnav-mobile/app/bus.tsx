import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Platform,
    SafeAreaView,
    StatusBar,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Configuration ─────────────────────────────────────────────────
const API_BASE = 'https://campusnav-backend.onrender.com'; // Update to your Render URL
const POLL_INTERVAL = 15000; // 15 seconds

// Minimal Dark Design System (Matched with Faculty/Chatbot)
const COLORS = {
    background: '#09090b',    // Zinc-950
    surface: '#18181b',       // Zinc-900 
    surfaceHighlight: '#27272a', // Zinc-800
    headerBorder: '#27272a',
    textPrimary: '#f4f4f5',   // Zinc-100
    textSecondary: '#a1a1aa', // Zinc-400
    accent: '#ffffff',
    primary: '#6366F1',       // Indigo
    success: '#10b981',       // Emerald-500
    error: '#ef4444',         // Red-500
};

// Generate Bus Data (Bus 1 to Bus 22)
// Bus 1 is LIVE — fetched from backend
// All others are static demo data
const generateStaticBuses = () => {
    return Array.from({ length: 22 }, (_, i) => {
        const busNum = i + 1;
        const isOutOfService = [5, 12, 18].includes(busNum);
        return {
            id: String(busNum),
            busApiId: busNum === 1 ? 'BUS_01' : null, // Only Bus 1 has hardware
            name: `Bus ${busNum}`,
            status: busNum === 1 ? 'Loading...' : (isOutOfService ? 'Not in Service' : 'On Road'),
            isActive: busNum === 1 ? false : !isOutOfService,
            isLive: busNum === 1, // Only Bus 1 is live-tracked
            speed: null as number | null,
            satellites: null as number | null,
            lastUpdated: null as string | null,
        };
    });
};

interface Bus {
    id: string;
    busApiId: string | null;
    name: string;
    status: string;
    isActive: boolean;
    isLive: boolean;
    speed: number | null;
    satellites: number | null;
    lastUpdated: string | null;
}

export default function BusScreen() {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [buses, setBuses] = useState<Bus[]>(generateStaticBuses());

    // ── Fetch live status for Bus 1 ───────────────────────────────
    const fetchLiveBusStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/bus/status/BUS_01`);
            const data = await response.json();

            setBuses(prev => prev.map(bus => {
                if (bus.id !== '1') return bus;

                if (data.success && data.bus) {
                    const isInService = data.bus.status === 'IN_SERVICE';
                    return {
                        ...bus,
                        status: isInService ? 'On Road' : 'Not in Service',
                        isActive: isInService,
                        speed: data.bus.speed ?? null,
                        satellites: data.bus.satellites ?? null,
                        lastUpdated: data.bus.last_updated ?? null,
                    };
                }

                // Bus not found in DB — hardware hasn't sent data yet
                return {
                    ...bus,
                    status: 'Not in Service',
                    isActive: false,
                };
            }));
        } catch (err) {
            // On error, show offline status
            setBuses(prev => prev.map(bus => {
                if (bus.id !== '1') return bus;
                return { ...bus, status: 'Not in Service', isActive: false };
            }));
        }
    }, []);

    useEffect(() => {
        fetchLiveBusStatus();
        const interval = setInterval(fetchLiveBusStatus, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchLiveBusStatus]);

    // ── Handlers ──────────────────────────────────────────────────
    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const handleTrackBus = (bus: Bus) => {
        if (bus.busApiId) {
            // Live bus — navigate to map
            router.push({
                pathname: '/bus-map',
                params: { busId: bus.busApiId, busName: bus.name },
            });
        } else {
            // Demo bus — navigate to map with bus name only
            router.push({
                pathname: '/bus-map',
                params: { busId: `BUS_${bus.id.padStart(2, '0')}`, busName: bus.name },
            });
        }
    };

    // ── Relative time helper ──────────────────────────────────────
    const getRelativeTime = (dateStr: string | null) => {
        if (!dateStr) return null;
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 10) return 'Just now';
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    };

    // ── Render ────────────────────────────────────────────────────
    const renderItem = ({ item }: { item: Bus }) => {
        const isExpanded = expandedId === item.id;
        const statusColor = item.isActive ? COLORS.success : COLORS.textSecondary;

        return (
            <View style={styles.cardContainer}>
                <TouchableOpacity
                    style={[styles.card, isExpanded && styles.cardExpanded]}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconContainer, item.isLive && item.isActive && styles.liveIconContainer]}>
                            <Ionicons name="bus" size={24} color={COLORS.textPrimary} />
                        </View>

                        <View style={styles.cardContent}>
                            <View style={styles.nameRow}>
                                <Text style={styles.busName}>{item.name}</Text>
                                {item.isLive && (
                                    <View style={styles.liveBadge}>
                                        <Text style={styles.liveBadgeText}>LIVE</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                <Text style={[styles.statusText, { color: statusColor }]}>
                                    {item.status}
                                </Text>
                                {item.isLive && item.lastUpdated && (
                                    <Text style={styles.timeText}>
                                        • {getRelativeTime(item.lastUpdated)}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={COLORS.textSecondary}
                        />
                    </View>

                    {isExpanded && (
                        <View style={styles.cardFooter}>
                            <View style={styles.divider} />

                            {/* Live stats for Bus 1 */}
                            {item.isLive && item.isActive && (
                                <View style={styles.liveStatsRow}>
                                    <View style={styles.liveStat}>
                                        <Ionicons name="speedometer-outline" size={14} color={COLORS.textSecondary} />
                                        <Text style={styles.liveStatText}>
                                            {item.speed != null ? (item.speed > 1 ? `${item.speed.toFixed(1)} km/h` : 'Stopped') : '—'}
                                        </Text>
                                    </View>
                                    <View style={styles.liveStat}>
                                        <Ionicons name="navigate-outline" size={14} color={COLORS.textSecondary} />
                                        <Text style={styles.liveStatText}>
                                            {item.satellites != null ? `${item.satellites} sats` : '—'}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {!item.isLive && (
                                <Text style={styles.placeholderText}>
                                    Live bus location will be available here
                                </Text>
                            )}

                            {item.isLive && !item.isActive && (
                                <Text style={styles.placeholderText}>
                                    Bus is currently not in service
                                </Text>
                            )}

                            <View style={styles.detailContainer}>
                                <TouchableOpacity
                                    style={[styles.trackButton, !item.isActive && styles.trackButtonDisabled]}
                                    onPress={() => handleTrackBus(item)}
                                >
                                    <Ionicons
                                        name="location-sharp"
                                        size={16}
                                        color={item.isActive ? COLORS.background : COLORS.textSecondary}
                                    />
                                    <Text style={[styles.trackButtonText, !item.isActive && styles.trackButtonTextDisabled]}>
                                        {item.isActive ? 'See Bus Location' : 'See Last Location'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bus Tracking</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Bus List */}
            <FlatList
                data={buses}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        height: Platform.OS === 'android' ? 90 : 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.headerBorder,
        backgroundColor: COLORS.background,
        marginTop: 10
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        letterSpacing: 0.5,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    listContent: {
        paddingVertical: 16,
        paddingBottom: 40,
    },
    cardContainer: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.headerBorder,
        overflow: 'hidden',
    },
    cardExpanded: {
        borderColor: COLORS.surfaceHighlight,
        backgroundColor: COLORS.surfaceHighlight,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: COLORS.headerBorder,
    },
    liveIconContainer: {
        borderColor: COLORS.success + '60',
        backgroundColor: COLORS.success + '15',
    },
    cardContent: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    busName: {
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    liveBadge: {
        backgroundColor: COLORS.success + '20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.success + '40',
    },
    liveBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: COLORS.success,
        letterSpacing: 0.5,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '500',
    },
    timeText: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    cardFooter: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.headerBorder,
        marginBottom: 16,
    },
    detailContainer: {
        marginTop: 12,
    },
    placeholderText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        fontStyle: 'italic',
    },
    // ── Live Stats ────────────────────────────────────────────────
    liveStatsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 4,
    },
    liveStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    liveStatText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    // ── Track Button ──────────────────────────────────────────────
    trackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.textPrimary,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    trackButtonDisabled: {
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.headerBorder,
    },
    trackButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.background,
    },
    trackButtonTextDisabled: {
        color: COLORS.textSecondary,
    },
});
