import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SectionList,
    Platform,
    SafeAreaView,
    StatusBar,
    LayoutAnimation,
    UIManager,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

// Faculty type matching MongoDB schema
interface Faculty {
    _id: string;
    id: string; // virtual getter for _id
    name: string;
    designation: string;
    department: string;
    email?: string;
    room_id?: string;
    availability?: string;
    specialization?: string;
    subjects?: string;
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Backend API URL
const API_BASE_URL = 'http://172.16.2.81:3000'; // Update with your backend IP

// Minimal Dark Design System
const COLORS = {
    background: '#09090b',    // Zinc-950
    surface: '#18181b',       // Zinc-900 
    surfaceHighlight: '#27272a', // Zinc-800
    headerBorder: '#27272a',
    textPrimary: '#f4f4f5',   // Zinc-100
    textSecondary: '#a1a1aa', // Zinc-400
    accent: '#ffffff',
    primary: '#6366F1',       // Indigo
    placeholder: '#71717a',
    success: '#22c55e',       // Green for location found
};

// Location data type
interface LocationData {
    facultyId: string;
    room: string;
    scannerId: string;
    lastSeen: string;
}

// Helper: Format relative time
function getTimeAgo(dateString: string): string {
    if (!dateString) return 'unknown';

    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
}

export default function FacultyScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Faculty data from MongoDB
    const [facultyData, setFacultyData] = useState<Faculty[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);

    // Location state
    const [locationData, setLocationData] = useState<LocationData | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationFacultyId, setLocationFacultyId] = useState<string | null>(null);

    // Fetch faculty data from MongoDB on mount
    useEffect(() => {
        const fetchFaculty = async () => {
            try {
                setDataLoading(true);
                setDataError(null);
                const response = await fetch(`${API_BASE_URL}/api/faculty`);
                if (!response.ok) {
                    throw new Error('Failed to load faculty data');
                }
                const data = await response.json();
                // Normalize _id to id for consistent usage
                const normalized = data.map((f: any) => ({
                    ...f,
                    id: f._id || f.id,
                }));
                setFacultyData(normalized);
            } catch (error: any) {
                console.error('Failed to fetch faculty:', error);
                setDataError(error.message || 'Failed to load faculty data');
            } finally {
                setDataLoading(false);
            }
        };

        fetchFaculty();
    }, []);

    // Filter and Group Data
    const sections = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();

        const filtered = facultyData.filter(f =>
            f.name.toLowerCase().includes(query) ||
            f.designation.toLowerCase().includes(query) ||
            f.department.toLowerCase().includes(query)
        );

        // Group by Department
        const grouped = filtered.reduce((acc, faculty) => {
            if (!acc[faculty.department]) {
                acc[faculty.department] = [];
            }
            acc[faculty.department].push(faculty);
            return acc;
        }, {} as Record<string, Faculty[]>);

        // Sort with CSE first, then the rest alphabetically
        const sortedDepts = Object.keys(grouped).sort((a, b) => {
            if (a === 'CSE') return -1;
            if (b === 'CSE') return 1;
            return a.localeCompare(b);
        });

        return sortedDepts.map(dept => ({
            title: dept,
            data: grouped[dept],
        }));
    }, [searchQuery, facultyData]);

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedId(expandedId === id ? null : id);
        // Clear location data when collapsing or switching cards
        if (expandedId === id || expandedId !== null) {
            setLocationData(null);
            setLocationError(null);
            setLocationFacultyId(null);
        }
    };

    // NEW: Fetch faculty location from backend
    const handleFindLocation = async (faculty: Faculty) => {
        setLocationLoading(true);
        setLocationError(null);
        setLocationData(null);
        setLocationFacultyId(faculty.id);

        try {
            const response = await fetch(`${API_BASE_URL}/api/faculty/location/${faculty.id}`);

            if (!response.ok) {
                throw new Error('Location unavailable');
            }

            const data: LocationData = await response.json();
            setLocationData(data);
        } catch (error) {
            setLocationError('Location unavailable');
        } finally {
            setLocationLoading(false);
        }
    };

    // NEW: Navigate to map with room as destination
    const handleNavigateToMap = (room: string) => {
        router.push({
            pathname: '/map',
            params: { destinationRoom: room }
        });
    };

    const renderSectionHeader = ({ section: { title } }: { section: { title: string } }) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );

    const renderItem = ({ item }: { item: Faculty }) => {
        const isExpanded = expandedId === item.id;
        const showLocation = locationFacultyId === item.id;

        return (
            <View style={styles.cardContainer}>
                <TouchableOpacity
                    style={[styles.card, isExpanded && styles.cardExpanded]}
                    onPress={() => toggleExpand(item.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={styles.name}>{item.name.replace('Dr.  ', 'Dr. ')}</Text>
                            <Text style={styles.designation}>{item.designation}</Text>
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
                            <View style={styles.detailRow}>
                                <View>
                                    <Text style={styles.detailLabel}>Department</Text>
                                    <Text style={styles.detailValue}>{item.department}</Text>
                                </View>

                                {/* Find Location Button - Only show if location not yet fetched */}
                                {!showLocation && !locationLoading && (
                                    <TouchableOpacity
                                        style={styles.navigateButton}
                                        onPress={() => handleFindLocation(item)}
                                    >
                                        <Ionicons name="location" size={16} color={COLORS.background} />
                                        <Text style={styles.navigateText}>Find Location</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Loading indicator */}
                                {locationLoading && locationFacultyId === item.id && (
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                )}
                            </View>

                            {/* Location Result - Show after fetch */}
                            {showLocation && locationData && (
                                <View style={styles.locationResultContainer}>
                                    <View style={styles.locationInfo}>
                                        <Text style={styles.locationLabel}>Current Location</Text>
                                        <Text style={styles.locationRoom}>{locationData.room}</Text>
                                        <Text style={styles.locationLastSeen}>
                                            Last seen: {getTimeAgo(locationData.lastSeen)}
                                        </Text>
                                    </View>

                                    {/* Navigate to Map Button */}
                                    <TouchableOpacity
                                        style={styles.mapButton}
                                        onPress={() => handleNavigateToMap(locationData.room)}
                                    >
                                        <Ionicons name="navigate" size={16} color={COLORS.background} />
                                        <Text style={styles.mapButtonText}>Navigate to Map</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Error State */}
                            {showLocation && locationError && (
                                <View style={styles.locationResultContainer}>
                                    <Text style={styles.errorText}>{locationError}</Text>
                                </View>
                            )}
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
                <Text style={styles.headerTitle}>Faculty Directory</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={COLORS.placeholder} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search faculty, dept, or role..."
                        placeholderTextColor={COLORS.placeholder}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Loading State */}
            {dataLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading faculty...</Text>
                </View>
            )}

            {/* Error State */}
            {!dataLoading && dataError && (
                <View style={styles.errorContainer}>
                    <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textSecondary} />
                    <Text style={styles.errorStateText}>{dataError}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                            setDataLoading(true);
                            setDataError(null);
                            fetch(`${API_BASE_URL}/api/faculty`)
                                .then(res => {
                                    if (!res.ok) throw new Error('Failed to load faculty data');
                                    return res.json();
                                })
                                .then(data => {
                                    const normalized = data.map((f: any) => ({
                                        ...f,
                                        id: f._id || f.id,
                                    }));
                                    setFacultyData(normalized);
                                })
                                .catch((err: any) => setDataError(err.message || 'Failed to load faculty data'))
                                .finally(() => setDataLoading(false));
                        }}
                    >
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* List */}
            {!dataLoading && !dataError && (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="people-outline" size={48} color={COLORS.surfaceHighlight} />
                            <Text style={styles.emptyText}>No faculty found</Text>
                        </View>
                    }
                />
            )}
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
    searchContainer: {
        padding: 16,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: 'transparent'
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.headerBorder,
    },
    searchInput: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: 15,
    },
    listContent: {
        paddingBottom: 40,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    cardContainer: {
        paddingHorizontal: 16,
        marginBottom: 8,
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
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.headerBorder,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    cardContent: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    designation: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    cardFooter: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.headerBorder,
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    navigateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.textPrimary,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    navigateText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.background,
    },
    // Location result styles
    locationResultContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.headerBorder,
    },
    locationInfo: {
        marginBottom: 12,
    },
    locationLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    locationRoom: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.success,
        marginBottom: 4,
    },
    locationLastSeen: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    mapButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.accent,
    },
    errorText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        marginTop: 12,
        color: COLORS.textSecondary,
        fontSize: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.textSecondary,
        fontSize: 15,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    errorStateText: {
        marginTop: 12,
        color: COLORS.textSecondary,
        fontSize: 15,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: COLORS.primary,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    retryText: {
        color: COLORS.accent,
        fontSize: 14,
        fontWeight: '600',
    },
});
