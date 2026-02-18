import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, TextInput, StatusBar, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { INDOOR_ROOMS } from '../src/modules/map/indoor/rooms';
import { INDOOR_DEPARTMENTS } from '../src/modules/map/indoor/department';

// Type definitions for our data
type RoomId = keyof typeof INDOOR_ROOMS;
type DepartmentId = keyof typeof INDOOR_DEPARTMENTS;

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function IndoorNavigationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ roomId?: string }>();
    const [selectedRoomId, setSelectedRoomId] = useState<RoomId | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);

    // New state for search functionality
    const [roomSearchText, setRoomSearchText] = useState('');
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<DepartmentId | null>(null);

    // Helper: Find which department contains a room
    const findDepartmentForRoom = (roomId: RoomId): DepartmentId | null => {
        for (const [deptId, deptData] of Object.entries(INDOOR_DEPARTMENTS)) {
            if (deptData.rooms.includes(roomId as string)) {
                return deptId as DepartmentId;
            }
        }
        return null;
    };

    // Auto-resolve room from parameters
    React.useEffect(() => {
        if (params.roomId && !selectedRoomId) {
            const searchText = params.roomId.trim();
            // Try to find matching room (case-insensitive)
            const roomKeys = Object.keys(INDOOR_ROOMS) as RoomId[];
            const matchedRoom = roomKeys.find(key =>
                key.toLowerCase() === searchText.toLowerCase() ||
                INDOOR_ROOMS[key].label.toLowerCase().includes(searchText.toLowerCase())
            );

            if (matchedRoom) {
                handleRoomSelect(matchedRoom);
            }
            // If no match, fall through to normal room selection UI
        }
    }, [params.roomId]);

    const handleRoomSelect = (roomId: RoomId) => {
        setSelectedRoomId(roomId);
        setCurrentStepIndex(0);
        setIsCompleted(false);
        setSearchError(null);
    };

    // Handle room search
    const handleRoomSearch = () => {
        const searchText = roomSearchText.trim();
        if (!searchText) {
            setSearchError('Please enter a room name or ID');
            return;
        }

        // Search for room (case-insensitive)
        const roomKeys = Object.keys(INDOOR_ROOMS) as RoomId[];
        const matchedRoom = roomKeys.find(key =>
            key.toLowerCase() === searchText.toLowerCase() ||
            INDOOR_ROOMS[key].label.toLowerCase().includes(searchText.toLowerCase())
        );

        if (matchedRoom) {
            // Room found - auto-select and start navigation
            handleRoomSelect(matchedRoom);
        } else {
            // Room not found - show error
            setSearchError('Room not found. Please select a department instead.');
        }
    };

    // Handle department selection
    const handleDepartmentSelect = (deptId: DepartmentId) => {
        setSelectedDepartment(deptId);
        setSearchError(null);
    };

    const currentRoom = selectedRoomId ? INDOOR_ROOMS[selectedRoomId] : null;
    const currentStep = currentRoom ? currentRoom.steps[currentStepIndex] : null;
    const totalSteps = currentRoom ? currentRoom.steps.length : 0;

    const getDirectionIcon = (instruction: string) => {
        const text = instruction.toLowerCase();
        if (text.includes('turn left') || text.includes('on the left')) return 'arrow-back';
        if (text.includes('turn right') || text.includes('on the right')) return 'arrow-forward';
        if (text.includes('go up') || text.includes('staircase') || text.includes('climb')) return 'arrow-up';
        if (text.includes('enter') || text.includes('located') || text.includes('visible')) return 'location';
        return 'navigate';
    };

    const handleNext = () => {
        if (currentStepIndex < totalSteps - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            setIsCompleted(true);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
            setIsCompleted(false);
        } else {
            setSelectedRoomId(null);
        }
    };

    const handleReset = () => {
        setSelectedRoomId(null);
        setCurrentStepIndex(0);
        setIsCompleted(false);
        setSelectedDepartment(null);
        setRoomSearchText('');
        setSearchError(null);
    };

    // --- RENDER: ROOM SELECTION (with Search & Department Browse) ---
    if (!selectedRoomId || !currentRoom) {
        // If department is selected, show rooms for that department
        if (selectedDepartment) {
            const deptRooms = INDOOR_DEPARTMENTS[selectedDepartment].rooms as RoomId[];
            return (
                <SafeAreaView style={styles.container}>
                    <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setSelectedDepartment(null)} style={styles.iconButton}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                            <Text style={styles.headerTitle}>{INDOOR_DEPARTMENTS[selectedDepartment].name}</Text>
                            <Text style={styles.headerSubtitle}>Select a Room</Text>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={styles.listContainer}>
                        {deptRooms.map((roomId) => (
                            <TouchableOpacity
                                key={roomId}
                                style={styles.glassCard}
                                onPress={() => handleRoomSelect(roomId)}
                            >
                                <View style={styles.roomIcon}>
                                    <Ionicons name="location" size={20} color="#00E0FF" />
                                </View>
                                <View style={styles.roomInfo}>
                                    <Text style={styles.roomName}>{INDOOR_ROOMS[roomId]?.label || roomId}</Text>
                                    <Text style={styles.roomSteps}>
                                        {INDOOR_ROOMS[roomId]?.steps?.length || 0} STEPS
                                    </Text>
                                </View>
                                <View style={styles.chevronBox}>
                                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            );
        }

        // Main selection screen: Room Search + Department Browse
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
                <View style={styles.header}>
                    <View>
                        <Text style={styles.tinyTag}>CAMPUS NAV</Text>
                        <Text style={styles.superHeaderTitle}>Indoor Guide</Text>
                        <Text style={styles.headerSubtitle}>Find your way inside</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.listContainer}>
                    {/* ROOM SEARCH SECTION */}
                    <View style={styles.searchSection}>
                        <View style={styles.searchInputContainer}>
                            <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" style={{ marginLeft: 16 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search room (e.g. D103)..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={roomSearchText}
                                onChangeText={(text) => {
                                    setRoomSearchText(text);
                                    setSearchError(null);
                                }}
                                onSubmitEditing={handleRoomSearch}
                            />
                            <TouchableOpacity
                                style={styles.searchButton}
                                onPress={handleRoomSearch}
                            >
                                <Ionicons name="arrow-forward" size={20} color="#0B0F19" />
                            </TouchableOpacity>
                        </View>
                        {searchError && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={16} color="#FF4B4B" />
                                <Text style={styles.errorText}>{searchError}</Text>
                            </View>
                        )}
                    </View>

                    {/* DIVIDER */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>BROWSE DEPARTMENTS</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* DEPARTMENT BROWSE SECTION */}
                    <View style={styles.browseSection}>
                        {(Object.keys(INDOOR_DEPARTMENTS) as DepartmentId[]).map((deptId) => (
                            <TouchableOpacity
                                key={deptId}
                                style={styles.glassCard}
                                onPress={() => handleDepartmentSelect(deptId)}
                            >
                                <View style={[styles.deptIcon, { backgroundColor: 'rgba(0, 224, 255, 0.1)' }]}>
                                    <Ionicons name="business" size={22} color="#00E0FF" />
                                </View>
                                <View style={styles.departmentInfo}>
                                    <Text style={styles.departmentName}>
                                        {INDOOR_DEPARTMENTS[deptId].name}
                                    </Text>
                                    <Text style={styles.departmentRooms}>
                                        {INDOOR_DEPARTMENTS[deptId].rooms.length} DESTINATIONS
                                    </Text>
                                </View>
                                <View style={styles.chevronBox}>
                                    <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.5)" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // --- RENDER: COMPLETION STATE ---
    if (isCompleted) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
                <View style={styles.glowCanvas}>
                    <View style={styles.glowOne} />
                    <View style={styles.glowTwo} />
                </View>

                <View style={styles.completionCard}>
                    <View style={styles.completionIconRing}>
                        <Ionicons name="checkmark" size={60} color="#0B0F19" />
                    </View>
                    <Text style={styles.successTitle}>Arrived</Text>
                    <Text style={styles.successMessage}>
                        You have reached {'\n'}<Text style={styles.highlightText}>{currentRoom.label}</Text>
                    </Text>

                    <TouchableOpacity style={styles.primaryButton} onPress={handleReset}>
                        <Text style={styles.primaryButtonText}>Find Another Destination</Text>
                        <Ionicons name="search" size={18} color="#0B0F19" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- RENDER: NAVIGATION STEPS ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

            {/* Header */}
            <View style={styles.navHeader}>
                <TouchableOpacity onPress={handleReset} style={styles.iconButton}>
                    <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={{ alignItems: 'flex-end', flex: 1 }}>
                    <Text style={styles.navHeaderLabel}>NAVIGATING TO</Text>
                    <Text style={styles.navHeaderDest}>{currentRoom.label}</Text>
                </View>
            </View>

            {/* Main Instruction Card */}
            <View style={styles.stepContainer}>
                <View style={styles.instructionCard}>
                    <View style={styles.glowOneSecondary} />

                    <View style={styles.stepIconRing}>
                        <Ionicons
                            name={getDirectionIcon(currentStep || "")}
                            size={60}
                            color="#FFF"
                        />
                    </View>

                    <Text style={styles.instructionBigNumber}>
                        {currentStepIndex + 1}
                        <Text style={styles.instructionTotal}> / {totalSteps}</Text>
                    </Text>

                    <Text style={styles.instructionText}>
                        {currentStep}
                    </Text>

                    {/* Progress Indicator */}
                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarTrack}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }
                                ]}
                            />
                        </View>
                    </View>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.secondaryButton, { opacity: currentStepIndex === 0 ? 0.3 : 1 }]}
                    onPress={handlePrevious}
                    disabled={currentStepIndex === 0}
                >
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.primaryButtonWide}
                    onPress={handleNext}
                >
                    <Text style={styles.primaryButtonText}>
                        {currentStepIndex === totalSteps - 1 ? "Finish" : "Next Step"}
                    </Text>
                    <Ionicons
                        name={currentStepIndex === totalSteps - 1 ? "checkmark" : "arrow-forward"}
                        size={20}
                        color="#0B0F19"
                        style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0F19', // Deep dark navy
    },
    centerContent: {
        justifyContent: 'center',
        padding: 24,
    },
    // Background Glows
    glowCanvas: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: 0,
    },
    glowOne: {
        position: 'absolute',
        top: -100,
        left: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#00E0FF',
        opacity: 0.15,
        transform: [{ scale: 1.5 }],
    },
    glowTwo: {
        position: 'absolute',
        bottom: -50,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#7000FF',
        opacity: 0.1,
        transform: [{ scale: 1.5 }],
    },
    glowOneSecondary: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#00E0FF',
        opacity: 0.1,
    },

    // Header Styles
    header: {
        paddingTop: Platform.OS === 'android' ? 48 : 24,
        paddingHorizontal: 24,
        paddingBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tinyTag: {
        color: '#00E0FF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 8,
    },
    superHeaderTitle: {
        fontSize: 36,
        fontWeight: '800',
        color: '#FFF',
        letterSpacing: -1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
        fontWeight: '400',
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },

    // List Styles
    listContainer: {
        padding: 24,
        paddingTop: 8,
    },

    // Search Section
    searchSection: {
        marginBottom: 32,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    searchInput: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#FFF',
    },
    searchButton: {
        backgroundColor: '#00E0FF',
        margin: 6,
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00E0FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 75, 75, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 75, 75, 0.3)',
        padding: 12,
        borderRadius: 12,
        marginTop: 12,
    },
    errorText: {
        color: '#FF4B4B',
        fontSize: 14,
        marginLeft: 8,
        fontWeight: '500',
        flex: 1,
    },

    // Divider
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2,
        marginHorizontal: 16,
    },

    // Browse Section & Cards
    browseSection: {
        marginBottom: 40,
    },
    glassCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 20,
        marginBottom: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    roomCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 20,
        marginBottom: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    deptIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    roomIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 224, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    departmentInfo: {
        flex: 1,
    },
    roomInfo: {
        flex: 1,
    },
    departmentName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 4,
    },
    roomName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 4,
    },
    departmentRooms: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '700',
        letterSpacing: 1,
    },
    roomSteps: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '700',
        letterSpacing: 1,
    },
    chevronBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Nav Header
    navHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'android' ? 48 : 24,
        paddingBottom: 24,
    },
    navHeaderLabel: {
        fontSize: 10,
        color: '#00E0FF',
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    navHeaderDest: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF',
    },

    // Step Styles
    stepContainer: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    instructionCard: {
        backgroundColor: '#151F2E',
        borderRadius: 32,
        padding: 40,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 10,
        overflow: 'hidden',
    },
    stepIconRing: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(0, 224, 255, 0.1)', // Subtle blue fill
        borderWidth: 2,
        borderColor: '#00E0FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    instructionBigNumber: {
        fontSize: 48,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 16,
    },
    instructionTotal: {
        fontSize: 20,
        color: 'rgba(255,255,255,0.3)',
        fontWeight: '500',
    },
    instructionText: {
        fontSize: 22,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
        lineHeight: 32,
        marginBottom: 40,
    },
    progressBarContainer: {
        width: '100%',
    },
    progressBarTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#00E0FF',
        borderRadius: 2,
    },

    // Controls
    controls: {
        flexDirection: 'row',
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    secondaryButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    secondaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    primaryButtonWide: {
        flex: 1,
        marginLeft: 16,
        height: 56,
        backgroundColor: '#00E0FF', // Neon Blue
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00E0FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 5,
    },
    primaryButton: {
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 30,
        backgroundColor: '#00E0FF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#0B0F19', // Dark text on bright button
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    // Completion
    completionCard: {
        width: '100%',
        alignItems: 'center',
        padding: 24,
    },
    completionIconRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#00E0FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        shadowColor: '#00E0FF',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    successTitle: {
        fontSize: 42,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 16,
        letterSpacing: -1,
    },
    successMessage: {
        fontSize: 18,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 48,
        lineHeight: 28,
    },
    highlightText: {
        color: '#00E0FF',
        fontWeight: '700',
    }
});
