import React, { useState } from 'react';
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
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
const BUS_DATA = Array.from({ length: 22 }, (_, i) => {
    const busNum = i + 1;
    // Simple logic to mix statuses: mostly active, some out of service
    // For demo purposes, let's say Bus 5, 12, 18 are "Not in Service"
    const isOutOfService = [5, 12, 18].includes(busNum);
    return {
        id: String(busNum),
        name: `Bus ${busNum}`,
        status: isOutOfService ? 'Not in Service' : 'On Road',
        isActive: !isOutOfService
    };
});

interface Bus {
    id: string;
    name: string;
    status: string;
    isActive: boolean;
}

export default function BusScreen() {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
    };

    const handleTrackBus = (busName: string) => {
        Alert.alert(
            "Coming Soon",
            "Bus tracking will be enabled soon"
        );
    };

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
                        <View style={styles.iconContainer}>
                            <Ionicons name="bus" size={24} color={COLORS.textPrimary} />
                        </View>

                        <View style={styles.cardContent}>
                            <Text style={styles.busName}>{item.name}</Text>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                                <Text style={[styles.statusText, { color: statusColor }]}>
                                    {item.status}
                                </Text>
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

                            <View style={styles.detailContainer}>
                                <Text style={styles.placeholderText}>
                                    Live bus location will be available here
                                </Text>

                                <TouchableOpacity
                                    style={styles.trackButton}
                                    onPress={() => handleTrackBus(item.name)}
                                >
                                    <Ionicons name="location-sharp" size={16} color={COLORS.background} />
                                    <Text style={styles.trackButtonText}>See Bus Location</Text>
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
                data={BUS_DATA}
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
    cardContent: {
        flex: 1,
    },
    busName: {
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
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
        gap: 16,
    },
    placeholderText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        fontStyle: 'italic',
    },
    trackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.textPrimary,
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    trackButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.background,
    },
});
