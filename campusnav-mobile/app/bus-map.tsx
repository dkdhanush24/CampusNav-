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
    stopMarker: '#f97316',
};

export default function BusMapScreen() {
    const router = useRouter();
    const { busId, busName } = useLocalSearchParams<{ busId: string; busName: string }>();

    const [bus, setBus] = useState<any>(null);
    const [stops, setStops] = useState<{ stop_name: string; latitude: number; longitude: number }[]>([]);
    const [eta, setEta] = useState<{ nearest_stop: string | null; distance_km: number | null; eta_minutes: number | string | null; eta_arrival: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);
    const mapRef = useRef<MapView>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const displayBusId = busId || 'BUS_01';
    const displayBusName = busName || 'Bus 1';

    // ── Fetch bus data + ETA ──────────────────────────────────────
    const fetchBusData = useCallback(async () => {
        try {
            // Use the unified endpoint that returns location + nearest stop + ETA
            const response = await fetch(`${API_BASE_URL}/api/bus/${displayBusId}`);
            const data = await response.json();

            if (data.success !== false && data.bus_id) {
                // Shape the bus object the way the rest of the UI expects it
                const busShape = {
                    bus_id: data.bus_id,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    speed: data.speed,
                    status: data.status,
                    satellites: data.satellites,
                    last_updated: data.last_updated,
                    last_updated_ist: data.last_updated_ist,
                };
                setBus(busShape);
                setError(null);

                // ETA fields
                setEta({
                    nearest_stop: data.nearest_stop ?? null,
                    distance_km: data.distance_km ?? null,
                    eta_minutes: data.eta_minutes ?? null,
                    eta_arrival: data.eta_arrival ?? null,
                });

                // Center map on bus if in service
                if (data.status === 'IN_SERVICE' && data.latitude && data.longitude && mapRef.current) {
                    mapRef.current.animateToRegion(
                        {
                            latitude: data.latitude,
                            longitude: data.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                        },
                        500
                    );
                }
            } else {
                setBus(null);
                setEta(null);
            }
        } catch (err: any) {
            setError('Network error');
            console.error('[BusMap] Fetch error:', err.message);
        } finally {
            setLoading(false);
            setLastFetch(new Date());
        }
    }, [displayBusId]);

    // ── Fetch bus stops (once on mount) ────────────────────────────
    const fetchBusStops = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/bus/${displayBusId}/stops`);
            const data = await response.json();
            if (Array.isArray(data)) {
                setStops(data);
            }
        } catch (err: any) {
            console.error('[BusMap] Stop fetch error:', err.message);
        }
    }, [displayBusId]);

    // ── Polling ───────────────────────────────────────────────────
    useEffect(() => {
        fetchBusData();
        fetchBusStops();
        intervalRef.current = setInterval(fetchBusData, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [fetchBusData, fetchBusStops]);

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

                        {/* ── Stop Markers ──────────────────────── */}
                        {stops.map((stop, index) => (
                            <Marker
                                key={`stop-${index}`}
                                coordinate={{
                                    latitude: stop.latitude,
                                    longitude: stop.longitude,
                                }}
                                title={stop.stop_name}
                            >
                                <View style={styles.stopMarkerContainer}>
                                    <View style={styles.stopMarkerDot}>
                                        <Ionicons name="flag" size={14} color="#fff" />
                                    </View>
                                    <View style={styles.stopMarkerArrow} />
                                </View>
                            </Marker>
                        ))}
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
                                Last seen: {bus.last_updated_ist || getRelativeTime(bus.last_updated)}
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

                        {/* ETA Card */}
                        {eta && eta.nearest_stop && (
                            <View style={styles.etaCard}>
                                <View style={styles.etaLeft}>
                                    <Ionicons name="flag" size={16} color={COLORS.stopMarker} />
                                    <Text style={styles.etaStopName} numberOfLines={1}>{eta.nearest_stop}</Text>
                                </View>
                                <View style={styles.etaRight}>
                                    <Text style={styles.etaValue}>
                                        {eta.eta_minutes === 'Arriving' ? '🚏 Arriving' : `${eta.eta_minutes} min`}
                                    </Text>
                                    {eta.eta_arrival && eta.eta_arrival !== 'Now' && (
                                        <Text style={styles.etaArrival}>Arrives at {eta.eta_arrival}</Text>
                                    )}
                                    {eta.distance_km !== null && (
                                        <Text style={styles.etaDist}>{eta.distance_km} km away</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Coordinates + IST Timestamp */}
                        <View style={styles.coordRow}>
                            <Text style={styles.coordText}>
                                {bus.latitude?.toFixed(6)}, {bus.longitude?.toFixed(6)}
                            </Text>
                            {bus.last_updated_ist && (
                                <Text style={[styles.coordText, { marginTop: 4 }]}>
                                    {bus.last_updated_ist} IST
                                </Text>
                            )}
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
    // ── Stop Markers ─────────────────────────────────────────────
    stopMarkerContainer: {
        alignItems: 'center',
    },
    stopMarkerDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.stopMarker,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    stopMarkerArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: COLORS.stopMarker,
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
    // ── ETA Card ──────────────────────────────────────────────────
    etaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginTop: 10,
        borderWidth: 1,
        borderColor: COLORS.stopMarker + '40',
    },
    etaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    etaStopName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    etaRight: {
        alignItems: 'flex-end',
    },
    etaValue: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.stopMarker,
    },
    etaDist: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    etaArrival: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.success,
        marginTop: 2,
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
