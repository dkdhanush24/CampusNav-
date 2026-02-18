
import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Alert,
    StatusBar,
    Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

// Data for the modules
const MODULES = [
    {
        id: 'chatbot',
        title: 'Chatbot',
        icon: '🤖',
        color: '#E3F2FD', // Light Blue
        borderColor: '#2196F3',
    },
    {
        id: 'faculty',
        title: 'Faculty Location',
        icon: '👨‍🏫',
        color: '#FFF3E0', // Light Orange
        borderColor: '#FF9800',
    },
    {
        id: 'map',
        title: 'Campus Map',
        icon: '🗺️',
        color: '#E8F5E9', // Light Green
        borderColor: '#4CAF50',
    },
    {
        id: 'bus',
        title: 'Bus Tracking',
        icon: '🚌',
        color: '#FCE4EC', // Light Pink
        borderColor: '#E91E63',
    },
];

export default function App() {
    const handleModulePress = (moduleName) => {
        Alert.alert(
            'Module Selected',
            `${moduleName} module coming soon`,
            [{ text: 'OK', onPress: () => console.log('OK Pressed') }]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Header Section */}
                <View style={styles.headerContainer}>
                    <Text style={styles.headerTitle}>CampusNav</Text>
                    <Text style={styles.headerSubtitle}>Welcome Student</Text>
                </View>

                {/* Modules Grid */}
                <View style={styles.gridContainer}>
                    {MODULES.map((module) => (
                        <TouchableOpacity
                            key={module.id}
                            style={[
                                styles.card,
                                { backgroundColor: module.color, borderColor: module.borderColor }
                            ]}
                            onPress={() => handleModulePress(module.title)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cardIcon}>{module.icon}</Text>
                            <Text style={styles.cardTitle}>{module.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
    },
    headerContainer: {
        marginBottom: 30,
        marginTop: 10,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 5,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: (width - 40 - 15) / 2, // (Screen width - total padding - gap) / 2
        aspectRatio: 1, // Square cards
        borderRadius: 20,
        padding: 15,
        marginBottom: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        elevation: 4, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
    },
    cardIcon: {
        fontSize: 48,
        marginBottom: 15,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        color: '#333',
    },
});
