import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    SafeAreaView,
    StatusBar,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../constants/api';

// Minimal Dark Design System (matching faculty.tsx)
const COLORS = {
    background: '#09090b',
    surface: '#18181b',
    surfaceHighlight: '#27272a',
    headerBorder: '#27272a',
    textPrimary: '#f4f4f5',
    textSecondary: '#a1a1aa',
    accent: '#ffffff',
    primary: '#6366F1',
    placeholder: '#71717a',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
};

// Status configuration
const STATUS_OPTIONS = [
    {
        value: 'available',
        label: 'Available',
        icon: 'checkmark-circle',
        color: COLORS.success,
        description: 'Students can see your location',
    },
    {
        value: 'busy',
        label: 'Busy',
        icon: 'time',
        color: COLORS.warning,
        description: 'Students can see your location',
    },
    {
        value: 'private_break',
        label: 'Not Available',
        icon: 'eye-off',
        color: COLORS.error,
        description: 'Location hidden · Auto-expires in 5 min',
    },
] as const;

type StatusType = 'available' | 'busy' | 'private_break';

export default function FacultyDashboardScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        token: string;
        facultyName: string;
        facultyDepartment: string;
        facultyId: string;
        currentStatus: string;
        statusUpdatedAt: string;
    }>();

    const [status, setStatus] = useState<StatusType>((params.currentStatus as StatusType) || 'available');
    const [loading, setLoading] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);

    // Timer for private break countdown
    const [countdown, setCountdown] = useState<number | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Tracks when private_break was actually activated (local or from login)
    const privateBreakStartRef = useRef<number | null>(null);

    // Start countdown when status is private_break
    useEffect(() => {
        if (status === 'private_break') {
            let initialSeconds = 300; // default 5 minutes

            if (privateBreakStartRef.current) {
                // UI-triggered: calculate from local ref
                const elapsed = Math.floor((Date.now() - privateBreakStartRef.current) / 1000);
                initialSeconds = Math.max(0, 300 - elapsed);
            } else if (params.statusUpdatedAt) {
                // Login-restored: calculate from server timestamp
                const elapsed = Math.floor((Date.now() - new Date(params.statusUpdatedAt).getTime()) / 1000);
                initialSeconds = Math.max(0, 300 - elapsed);
            }

            if (initialSeconds <= 0) {
                setStatus('available');
                setCountdown(null);
                privateBreakStartRef.current = null;
                return;
            }

            setCountdown(initialSeconds);

            countdownRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev === null || prev <= 1) {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        setStatus('available');
                        return null;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            // Clear countdown if status changes away from private_break
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
            setCountdown(null);
            privateBreakStartRef.current = null;
        }

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [status]);

    // Format seconds to MM:SS
    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleStatusChange = async (newStatus: StatusType) => {
        if (newStatus === status || loading) return;

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/faculty/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${params.token}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                Alert.alert('Error', data.error || 'Failed to update status.');
                return;
            }

            // Set local timestamp BEFORE updating status (so useEffect sees it)
            if (newStatus === 'private_break') {
                privateBreakStartRef.current = Date.now();
            }

            setStatus(newStatus);
        } catch (err) {
            Alert.alert('Error', 'Connection failed. Check your network.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Your status will be reset to Available. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        setLogoutLoading(true);
                        try {
                            await fetch(`${API_BASE_URL}/api/faculty/logout`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${params.token}`,
                                },
                            });
                        } catch { /* proceed anyway */ }

                        setLogoutLoading(false);
                        router.replace('/');
                    },
                },
            ]
        );
    };

    const currentOption = STATUS_OPTIONS.find(o => o.value === status);

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Faculty Dashboard</Text>
                <TouchableOpacity onPress={handleLogout} disabled={logoutLoading}>
                    {logoutLoading ? (
                        <ActivityIndicator size="small" color={COLORS.textSecondary} />
                    ) : (
                        <Ionicons name="log-out-outline" size={22} color={COLORS.textSecondary} />
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                {/* Faculty Info */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarLargeText}>
                            {params.facultyName?.charAt(0) || 'F'}
                        </Text>
                    </View>
                    <Text style={styles.profileName}>{params.facultyName}</Text>
                    <Text style={styles.profileDepartment}>{params.facultyDepartment}</Text>

                    {/* Current Status Badge */}
                    <View style={[styles.statusBadge, { borderColor: currentOption?.color }]}>
                        <Ionicons
                            name={currentOption?.icon as any}
                            size={14}
                            color={currentOption?.color}
                        />
                        <Text style={[styles.statusBadgeText, { color: currentOption?.color }]}>
                            {currentOption?.label}
                        </Text>
                    </View>

                    {/* Countdown Timer */}
                    {countdown !== null && (
                        <View style={styles.timerContainer}>
                            <Ionicons name="timer-outline" size={16} color={COLORS.error} />
                            <Text style={styles.timerText}>
                                Auto-resets in {formatCountdown(countdown)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Status Selector */}
                <Text style={styles.sectionLabel}>SET YOUR STATUS</Text>
                <View style={styles.statusList}>
                    {STATUS_OPTIONS.map((option) => {
                        const isSelected = status === option.value;
                        return (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.statusOption,
                                    isSelected && styles.statusOptionSelected,
                                    isSelected && { borderColor: option.color },
                                ]}
                                onPress={() => handleStatusChange(option.value)}
                                activeOpacity={0.7}
                                disabled={loading}
                            >
                                <View style={styles.statusOptionLeft}>
                                    <View style={[
                                        styles.radioOuter,
                                        isSelected && { borderColor: option.color },
                                    ]}>
                                        {isSelected && (
                                            <View style={[styles.radioInner, { backgroundColor: option.color }]} />
                                        )}
                                    </View>
                                    <View>
                                        <View style={styles.statusLabelRow}>
                                            <Ionicons
                                                name={option.icon as any}
                                                size={18}
                                                color={isSelected ? option.color : COLORS.textSecondary}
                                            />
                                            <Text style={[
                                                styles.statusLabel,
                                                isSelected && { color: COLORS.textPrimary },
                                            ]}>
                                                {option.label}
                                            </Text>
                                        </View>
                                        <Text style={styles.statusDescription}>{option.description}</Text>
                                    </View>
                                </View>

                                {loading && status !== option.value && (
                                    <ActivityIndicator size="small" color={COLORS.textSecondary} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
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
        marginTop: 10,
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
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 32,
    },
    profileCard: {
        alignItems: 'center',
        marginBottom: 36,
    },
    avatarLarge: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    avatarLargeText: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.primary,
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    profileDepartment: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 16,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: COLORS.surface,
    },
    statusBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    timerText: {
        color: COLORS.error,
        fontSize: 13,
        fontWeight: '600',
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSecondary,
        letterSpacing: 1,
        marginBottom: 12,
    },
    statusList: {
        gap: 10,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.5,
        borderColor: COLORS.headerBorder,
    },
    statusOptionSelected: {
        backgroundColor: COLORS.surfaceHighlight,
    },
    statusOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: COLORS.headerBorder,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    statusLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    statusLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    statusDescription: {
        fontSize: 12,
        color: COLORS.placeholder,
        marginLeft: 26,
    },
});
