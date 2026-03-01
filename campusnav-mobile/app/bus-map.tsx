import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Platform,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

import { API_BASE_URL } from '../constants/api';

// ── Configuration ─────────────────────────────────────────────────
const POLL_INTERVAL = 10000; // 10 seconds

// Default campus center (update to your campus coordinates)
const DEFAULT_REGION = {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
};

// Design System (Matched with bus.tsx)
const COLORS = {
    background: '#09090b',
    surface: '#18181b',
    surfaceHighlight: '#27272a',
    headerBorder: '#27272a',
    textPrimary: '#f4f4f5',
    textSecondary: '#a1a1aa',
    accent: '#ffffff',
    primary: '#6366F1',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
};

export default function BusMapScreen() {
    const router = useRouter();
    const { busId, busName } = useLocalSearchParams<{ busId: string; busName: string }>();

    const [bus, setBus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);
    const mapRef = useRef<MapView>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const displayBusId = busId || 'BUS_01';
    const displayBusName = busName || 'Bus 1';

    // ── Fetch bus data ────────────────────────────────────────────
    const fetchBusData = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/bus/status/${displayBusId}`);
            const data = await response.json();

            if (data.success && data.bus) {
                setBus(data.bus);
                setError(null);

                // Center map on bus if in service
                if (data.bus.status === 'IN_SERVICE' && data.bus.latitude && data.bus.longitude && mapRef.current) {
                    mapRef.current.animateToRegion(
                        {
                            latitude: data.bus.latitude,
                            longitude: data.bus.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                        },
                        500
                    );
                }
            } else {
                // Bus not found in DB yet — show as not in service
                setBus(null);
            }
        } catch (err: any) {
            setError('Network error');
            console.error('[BusMap] Fetch error:', err.message);
        } finally {
            setLoading(false);
            setLastFetch(new Date());
        }
    }, [displayBusId]);

    // ── Polling ───────────────────────────────────────────────────
    useEffect(() => {
        fetchBusData();
        intervalRef.current = setInterval(fetchBusData, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [fetchBusData]);

    // ── Helpers ───────────────────────────────────────────────────
    const getRelativeTime = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 10) return 'Just now';
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    };

    const getSpeedText = (speed: number) => {
        if (!speed || speed <= 1) return 'Stopped';
        if (speed <= 5) return 'Arriving';
        return `${speed.toFixed(1)} km/h`;
    };

    const isInService = bus?.status === 'IN_SERVICE';

    // ══════════════════════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════════════════════
    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* ── Header ──────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{displayBusName}</Text>
                <View style={styles.headerRight}>
                    <View
                        style={[
                            styles.liveDot,
                            { backgroundColor: error ? COLORS.error : (isInService ? COLORS.success : COLORS.textSecondary) },
                        ]}
                    />
                    <Text style={[styles.liveLabel, { color: error ? COLORS.error : COLORS.textSecondary }]}>
                        {error ? 'Offline' : (isInService ? 'Live' : 'Idle')}
                    </Text>
                </View>
            </View>

            {/* ── Map ─────────────────────────────────────────── */}
            <View style={styles.mapContainer}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Loading bus location...</Text>
                    </View>
                ) : (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        mapType="satellite"
                        initialRegion={
                            bus && bus.latitude && bus.longitude
                                ? {
                                    latitude: bus.latitude,
                                    longitude: bus.longitude,
                                    latitudeDelta: 0.005,
                                    longitudeDelta: 0.005,
                                }
                                : DEFAULT_REGION
                        }
                        showsUserLocation={true}
                        showsMyLocationButton={true}
                        showsCompass={true}
                        customMapStyle={darkMapStyle}
                    >
                        {bus && bus.latitude && bus.longitude && (
                            <Marker
                                coordinate={{
                                    latitude: bus.latitude,
                                    longitude: bus.longitude,
                                }}
                                title={displayBusName}
                                description={isInService ? getSpeedText(bus.speed) : 'Not In Service'}
                            >
                                <View style={styles.markerContainer}>
                                    <View style={[styles.markerDot, { backgroundColor: isInService ? COLORS.success : COLORS.error }]}>
                                        <Ionicons name="bus" size={18} color="#fff" />
                                    </View>
                                    <View style={[styles.markerArrow, { borderTopColor: isInService ? COLORS.success : COLORS.error }]} />
                                </View>
                            </Marker>
                        )}
                    </MapView>
                )}
            </View>

            {/* ── Info Panel ──────────────────────────────────── */}
            <View style={styles.infoPanel}>
                {/* Status Card */}
                {!loading && !bus && (
                    <View style={styles.statusCard}>
                        <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
                        <Text style={styles.noDataText}>No data for {displayBusName} yet</Text>
                    </View>
                )}

                {bus && !isInService && (
                    <View style={[styles.statusCard, styles.offlineCard]}>
                        <Ionicons name="close-circle" size={20} color={COLORS.error} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.statusLabel, { color: COLORS.error }]}>Not In Service</Text>
                            <Text style={styles.statusSubtext}>
                                Last seen {getRelativeTime(bus.last_updated)}
                            </Text>
                        </View>
                    </View>
                )}

                {bus && isInService && (
                    <>
                        {/* Live Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Ionicons name="speedometer-outline" size={18} color={COLORS.textSecondary} />
                                <Text style={styles.statValue}>{getSpeedText(bus.speed)}</Text>
                                <Text style={styles.statLabel}>Speed</Text>
                            </View>

                            <View style={styles.statDivider} />

                            <View style={styles.statItem}>
                                <Ionicons name="navigate-outline" size={18} color={COLORS.textSecondary} />
                                <Text style={styles.statValue}>{bus.satellites || 0}</Text>
                                <Text style={styles.statLabel}>Satellites</Text>
                            </View>

                            <View style={styles.statDivider} />

                            <View style={styles.statItem}>
                                <Ionicons name="time-outline" size={18} color={COLORS.textSecondary} />
                                <Text style={styles.statValue}>{getRelativeTime(bus.last_updated)}</Text>
                                <Text style={styles.statLabel}>Updated</Text>
                            </View>
                        </View>

                        {/* Coordinates */}
                        <View style={styles.coordRow}>
                            <Text style={styles.coordText}>
                                {bus.latitude?.toFixed(6)}, {bus.longitude?.toFixed(6)}
                            </Text>
                        </View>
                    </>
                )}

                {/* Refresh indicator */}
                {lastFetch && (
                    <Text style={styles.refreshText}>
                        Auto-refreshes every 10s
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
}

// ── Dark Map Style ────────────────────────────────────────────────
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#212121' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

// ══════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    // ── Header ────────────────────────────────────────────────────
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
        marginTop: 10,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        letterSpacing: 0.5,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    liveLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    // ── Map ───────────────────────────────────────────────────────
    mapContainer: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    // ── Marker ────────────────────────────────────────────────────
    markerContainer: {
        alignItems: 'center',
    },
    markerDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    markerArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -2,
    },
    // ── Info Panel ────────────────────────────────────────────────
    infoPanel: {
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.headerBorder,
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        padding: 14,
        borderRadius: 10,
        gap: 10,
    },
    offlineCard: {
        borderWidth: 1,
        borderColor: COLORS.error + '30',
    },
    statusLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    statusSubtext: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    noDataText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    // ── Stats ─────────────────────────────────────────────────────
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    statValue: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: COLORS.headerBorder,
    },
    coordRow: {
        marginTop: 10,
        alignItems: 'center',
    },
    coordText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: COLORS.textSecondary,
    },
    refreshText: {
        textAlign: 'center',
        fontSize: 11,
        color: COLORS.textSecondary + '80',
        marginTop: 10,
    },
});
