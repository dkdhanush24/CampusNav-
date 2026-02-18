import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Dimensions, FlatList, Modal, Image, TextInput } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { findGraphPath } from '../src/modules/map/graph';
import { INDOOR_ROOMS } from '../src/modules/map/indoor/rooms';
import { INDOOR_DEPARTMENTS } from '../src/modules/map/indoor/department';

// --- CAMPUS DATA ---
const CAMPUS_CENTER = {
    latitude: 8.994451,
    longitude: 76.695654,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
};

const BUILDINGS = [
    { id: '1', title: 'Administrative Block', description: 'Main Office', coords: { latitude: 8.994678336848386, longitude: 76.69581836229666 } },
    { id: '2', title: 'College Store', description: 'Supplies & Stationery', coords: { latitude: 8.99486925582077, longitude: 76.69619292116835 } },
    { id: '3', title: 'College Canteen', description: 'Food Court', coords: { latitude: 8.994863378658767, longitude: 76.6962820755256 } },
    { id: '4', title: 'College Library', description: 'Books & Reading', coords: { latitude: 8.994870001718983, longitude: 76.6964081393486 } },
    { id: '5', title: 'Biomedical Engineering Department', description: 'BME Dept', coords: { latitude: 8.995398669599032, longitude: 76.69579045545548 } },
    { id: '6', title: 'Computer Science & Engineering Department', description: 'Computer Science', coords: { latitude: 8.995359288702888, longitude: 76.69527372372328 } },
    { id: '7', title: 'Mechanical & Civil Engineering', description: 'Mechanical & Civil', coords: { latitude: 8.99544828952255, longitude: 76.69528010312696 } },
    { id: '8', title: 'Electrical & Electronics Engineering', description: 'Electrical & Electronics', coords: { latitude: 8.995209641257036, longitude: 76.69477214307679 } },
];

const ALERT_THRESHOLD_METERS = 25;

export default function OutdoorMapScreen() {
    const [selectedBuilding, setSelectedBuilding] = useState<typeof BUILDINGS[0] | null>(null);
    const [startNodeId, setStartNodeId] = useState<string | null>(null);
    const [selectionMode, setSelectionMode] = useState<'start' | 'dest'>('dest');
    const [activePath, setActivePath] = useState<any[] | null>(null);
    const [pathDistance, setPathDistance] = useState<number | null>(null);
    const mapRef = useRef<MapView>(null);

    // UI State
    const [modalVisible, setModalVisible] = useState(false);
    const [indoorSearchText, setIndoorSearchText] = useState('');
    const [searchedRoomId, setSearchedRoomId] = useState<string | null>(null); // Track searched room




    // --- RECALCULATE PATH ---
    // --- RECALCULATE PATH ---
    useEffect(() => {
        if (selectedBuilding && startNodeId) {
            const points = findGraphPath(startNodeId, selectedBuilding.id);
            setActivePath(points);

            // Calculate total path distance
            let dist = 0;
            for (let i = 0; i < points.length - 1; i++) {
                dist += calculateDistance(points[i], points[i + 1]);
            }
            setPathDistance(dist);
        } else {
            setActivePath(null);
            setPathDistance(null);
        }
    }, [startNodeId, selectedBuilding]);

    // --- HELPER: Haversine ---
    const calculateDistance = (p1: { latitude: number, longitude: number }, p2: { latitude: number, longitude: number }) => {
        const R = 6371e3;
        const lat1 = p1.latitude;
        const lon1 = p1.longitude;
        const lat2 = p2.latitude;
        const lon2 = p2.longitude;

        const phi1 = (lat1 * Math.PI) / 180;
        const phi2 = (lat2 * Math.PI) / 180;
        const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
        const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    };

    // --- HANDLE SELECTION ---
    // --- HANDLE SELECTION ---
    const handleSelectBuilding = (building: typeof BUILDINGS[0]) => {
        if (selectionMode === 'dest') {
            setSelectedBuilding(building);

            // Animate Map
            mapRef.current?.animateToRegion({
                latitude: building.coords.latitude,
                longitude: building.coords.longitude,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002,
            }, 1000);
        } else {
            setStartNodeId(building.id);
        }
        setModalVisible(false);
    };

    const openSelectionModal = (mode: 'start' | 'dest') => {
        setSelectionMode(mode);
        setModalVisible(true);
    };

    // Find which building contains a room
    const findBuildingForRoom = (roomId: string): typeof BUILDINGS[0] | null => {
        // Search through departments to find which one has this room
        for (const [deptId, deptData] of Object.entries(INDOOR_DEPARTMENTS)) {
            if (deptData.rooms.includes(roomId)) {
                // Map department to building
                const deptName = deptData.name;

                // Normalize strings for comparison (remove special chars, handle 'and' vs '&')
                const normalizeName = (name: string) =>
                    name.toLowerCase()
                        .replace(/&/g, 'and')
                        .replace(/[^a-z0-9\s]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                const normalizedDeptName = normalizeName(deptName);

                const building = BUILDINGS.find(b => {
                    const normalizedBuildingTitle = normalizeName(b.title);
                    return normalizedBuildingTitle.includes(normalizedDeptName) ||
                        normalizedDeptName.includes(normalizedBuildingTitle);
                });

                return building || null;
            }
        }
        return null;
    };

    const handleRoomSearch = () => {
        const searchText = indoorSearchText.trim();
        if (!searchText) return;

        // Search for room in INDOOR_ROOMS
        const roomKeys = Object.keys(INDOOR_ROOMS) as Array<keyof typeof INDOOR_ROOMS>;
        const matchedRoom = roomKeys.find(key =>
            key.toLowerCase() === searchText.toLowerCase() ||
            INDOOR_ROOMS[key].label.toLowerCase().includes(searchText.toLowerCase())
        );

        if (matchedRoom) {
            // Room found - find its building
            const building = findBuildingForRoom(matchedRoom);

            if (building) {
                // Check if start location is set
                if (!startNodeId) {
                    Alert.alert(
                        'Start Location Required',
                        'Please select a start location first to navigate to this room.',
                        [{ text: 'OK' }]
                    );
                    return;
                }

                // Set the building as destination
                setSelectedBuilding(building);
                setSearchedRoomId(matchedRoom);

                // Animate to building
                mapRef.current?.animateToRegion({
                    latitude: building.coords.latitude,
                    longitude: building.coords.longitude,
                    latitudeDelta: 0.002,
                    longitudeDelta: 0.002,
                }, 1000);
            } else {
                Alert.alert(
                    'Building Not Found',
                    'Could not find the building for this room.',
                    [{ text: 'OK' }]
                );
            }
        } else {
            Alert.alert(
                'Room Not Found',
                'No room found with that name. Please try again or browse departments in indoor navigation.',
                [{ text: 'OK' }]
            );
        }
    };

    const handleSwitchToIndoor = () => {
        // Navigate to indoor screen with the searched room
        if (searchedRoomId) {
            router.push({
                pathname: '/indoor',
                params: { roomId: searchedRoomId }
            });
        } else if (indoorSearchText.trim()) {
            router.push({
                pathname: '/indoor',
                params: { roomId: indoorSearchText.trim() }
            });
        } else {
            router.push('/indoor');
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* MAP */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                mapType="satellite"
                initialRegion={CAMPUS_CENTER}
                showsUserLocation={false}
                showsCompass={false}
                showsMyLocationButton={false}
                minZoomLevel={16}
                maxZoomLevel={20}
            >
                {BUILDINGS.map((building) => (
                    <Marker
                        key={building.id}
                        coordinate={building.coords}
                        title={building.title}
                        description={building.description}
                        pinColor={selectedBuilding?.id === building.id ? "#4dff88" : "red"}
                        onPress={() => handleSelectBuilding(building)}
                    />
                ))}

                {selectedBuilding && startNodeId && activePath && (
                    <Polyline
                        coordinates={activePath}
                        strokeColor="#4da6ff"
                        strokeWidth={4}
                    />
                )}
            </MapView>

            {/* HEADER */}
            <View style={styles.headerOverlay}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Campus Map</Text>
            </View>

            {/* TOP SEARCH BAR - Independent Indoor Search */}
            <View style={styles.topSearchContainer}>
                <View style={styles.searchBarWrapper}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.topSearchInput}
                        placeholder="Search room for indoor navigation..."
                        placeholderTextColor="#999"
                        value={indoorSearchText}
                        onChangeText={setIndoorSearchText}
                        onSubmitEditing={handleRoomSearch}
                    />
                    {indoorSearchText.length > 0 && (
                        <TouchableOpacity onPress={() => setIndoorSearchText('')} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={20} color="#666" />
                        </TouchableOpacity>
                    )}
                </View>
                {indoorSearchText.trim().length > 0 && (
                    <TouchableOpacity
                        style={styles.goIndoorButton}
                        onPress={handleRoomSearch}
                    >
                        <Ionicons name="search" size={18} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* BOTTOM PANEL */}
            <View style={styles.bottomCard}>
                <View style={styles.cardHeader}>
                    <View style={[styles.statusIndicator, { backgroundColor: (selectedBuilding && startNodeId) ? '#4dff88' : '#888' }]} />
                    <Text style={styles.statusText}>
                        {(selectedBuilding && startNodeId) ? "Outdoor Navigation Active" : "Plan Your Route"}
                    </Text>
                </View>

                {/* VISIBLE SELECTORS ALWAYS */}
                <View style={{ marginBottom: 15 }}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                        onPress={() => openSelectionModal('start')}
                    >
                        <Ionicons name="radio-button-on" size={16} color="#4da6ff" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#aaa', fontSize: 13, width: 40 }}>From: </Text>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                            {startNodeId ? BUILDINGS.find(b => b.id === startNodeId)?.title : "Select Start Location"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => openSelectionModal('dest')}
                    >
                        <Ionicons name="location" size={16} color="#4dff88" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#aaa', fontSize: 13, width: 40 }}>To: </Text>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                            {selectedBuilding ? selectedBuilding.title : "Select Destination"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {selectedBuilding && startNodeId && (
                    <>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Distance</Text>
                                <Text style={styles.statValue}>
                                    {pathDistance !== null ? `${pathDistance} m` : "..."}
                                </Text>
                            </View>
                            <View style={styles.verticalDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Est. Walking</Text>
                                <Text style={styles.statValue}>
                                    {pathDistance !== null ? `${Math.ceil(pathDistance / 80)} min` : "--"}
                                </Text>
                            </View>
                        </View>

                        {/* Indoor Navigation Button - Only show if room was searched */}
                        {searchedRoomId && (
                            <TouchableOpacity
                                style={styles.indoorNavButton}
                                onPress={handleSwitchToIndoor}
                            >
                                <Ionicons name="business" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.indoorNavButtonText}>Start Indoor Navigation</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            {/* SELECTION MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectionMode === 'start' ? "Select Start Location" : "Select Destination"}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={BUILDINGS}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => handleSelectBuilding(item)}
                                >
                                    <View style={styles.modalItemIcon}>
                                        <Ionicons name="location" size={20} color="#888" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalItemTitle}>{item.title}</Text>
                                        <Text style={styles.modalItemDesc}>{item.description}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="#444" />
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    map: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    headerOverlay: {
        position: 'absolute',
        top: 50,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    bottomCard: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(25, 25, 25, 0.95)',
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 13,
        elevation: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    statusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        color: '#8e8e93',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    destinationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    textContainer: {
        flex: 1,
    },
    destinationLabel: {
        color: '#8e8e93',
        fontSize: 12,
        marginBottom: 4,
    },
    destinationName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 15,
        marginBottom: 15,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    verticalDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        height: '80%',
        alignSelf: 'center',
    },
    statLabel: {
        color: '#8e8e93',
        fontSize: 11,
        marginBottom: 4,
    },
    statValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    noSelectionContainer: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    selectButton: {
        flexDirection: 'row',
        backgroundColor: '#0A84FF',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 30,
        alignItems: 'center',
    },
    selectButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    changeDestButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    changeDestText: {
        color: '#4da6ff',
        fontWeight: '600',
        fontSize: 14,
    },

    // MODAL STYLES
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '50%', // Half screen
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 15,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    modalItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    modalItemTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    modalItemDesc: {
        color: '#8e8e93',
        fontSize: 12,
        marginTop: 2,
    },

    // Top Search Bar Styles
    topSearchContainer: {
        position: 'absolute',
        top: 110,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    searchBarWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    searchIcon: {
        marginRight: 10,
    },
    topSearchInput: {
        flex: 1,
        fontSize: 15,
        color: '#333',
    },
    clearButton: {
        padding: 4,
    },
    goIndoorButton: {
        backgroundColor: '#4A90E2',
        borderRadius: 16,
        padding: 14,
        marginLeft: 12,
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },

    // Indoor Navigation Button (bottom panel)
    indoorNavButton: {
        backgroundColor: '#4dff88',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        shadowColor: '#4dff88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    indoorNavButtonText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 16,
    },
});
