import { router } from "expo-router";


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
  Image,
  ImageBackground,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_GAP = 16;
const CARD_WIDTH = (width - 40 - CARD_GAP) / 2;

// Modules configuration
const MODULES = [
  {
    id: 'chatbot',
    title: 'AI Assistant',
    subtitle: 'Ask anything',
    image: require('../assets/images/icon_chatbot.png'),
    accent: '#2196F3',
  },
  {
    id: 'faculty',
    title: 'Faculty',
    subtitle: 'Find professors',
    image: require('../assets/images/icon_faculty.png'),
    accent: '#FF9800',
  },
  {
    id: 'map',
    title: 'Campus Map',
    subtitle: 'Navigate easily',
    image: require('../assets/images/icon_map.png'),
    accent: '#4CAF50',
  },
  {
    id: 'bus',
    title: 'Bus Tracker',
    subtitle: 'Live updates',
    image: require('../assets/images/icon_bus.png'),
    accent: '#E91E63',
  },
];

export default function Home() {
  const handlePress = (moduleId: string, moduleTitle: string) => {
    if (moduleId === 'map') {
      router.push('/map');
      return;
    }

    if (moduleId === 'chatbot') {
      router.push('/chatbot');
      return;
    }

    if (moduleId === 'faculty') {
      router.push('/faculty');
      return;
    }

    if (moduleId === 'bus') {
      router.push('/bus');
      return;
    }

    Alert.alert(
      'Coming Soon',
      `The ${moduleTitle} module is currently under development.`,
      [{ text: 'Got it', style: 'default' }]
    );
  };



  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero Section */}
        <View style={styles.headerWrapper}>
          <ImageBackground
            source={require('../assets/images/header_bg.png')}
            style={styles.headerImage}
            imageStyle={styles.headerImageStyle}
          >
            <View style={styles.headerOverlay}>
              <View style={styles.headerContent}>
                <Text style={styles.appName}>CampusNav</Text>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>System Online</Text>
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Modules Grid */}
        <View style={styles.gridContainer}>
          <Text style={styles.sectionTitle}>Explore Categories</Text>
          <View style={styles.grid}>
            {MODULES.map((module) => (
              <TouchableOpacity
                key={module.id}
                style={styles.cardContainer}
                activeOpacity={0.9}
                onPress={() => handlePress(module.id, module.title)}
              >
                <View style={[styles.card, { shadowColor: module.accent }]}>
                  <View style={styles.imageContainer}>
                    <Image
                      source={module.image}
                      style={styles.cardImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{module.title}</Text>
                    <Text style={styles.cardSubtitle}>{module.subtitle}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Footer info (Clean minimal look) */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 1.0.0 • CampusNav </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA', // Premium Off-White
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  // Header Styling
  headerWrapper: {
    height: 280,
    width: '100%',
    backgroundColor: '#000',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginBottom: 24,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerImageStyle: {
    opacity: 0.9,
  },
  headerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)', // Subtle dark overlay for text readability
    justifyContent: 'flex-end',
    padding: 24,
    paddingBottom: 40,
  },
  headerContent: {
    alignItems: 'flex-start',
  },
  greeting: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Grid Styling
  gridContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    marginLeft: 4,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginBottom: CARD_GAP,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    height: 190,
    justifyContent: 'space-between',
    // Luxury Shadow
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  imageContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: {
    width: 85,
    height: 85,
  },
  cardContent: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },

  // Footer
  footer: {
    paddingTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '500',
  },
});
