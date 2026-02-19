import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    Keyboard,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { API_BASE_URL } from '../constants/api';

// Minimal Design System
const COLORS = {
    background: '#09090b',
    headerBorder: '#27272a',
    surface: '#18181b',
    textPrimary: '#f4f4f5',
    textSecondary: '#a1a1aa',
    userBubble: '#27272a',
    botBubble: 'transparent',
    accent: '#ffffff',
    placeholder: '#71717a',
};

type Message = {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
};

const API_URL = `${API_BASE_URL}/api/chat`;

export default function ChatbotScreen() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: "Hello. I'm your Campus Assistant. How can I help you?",
            sender: 'bot',
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    /**
     * Send message to backend and handle response
     * Flow: Validate → Add user message → Call API → Show bot response
     */
    const handleSend = async () => {
        // Trim and validate input
        const trimmedInput = inputText.trim();
        if (!trimmedInput) return;

        // Create and add user message
        const userMsg: Message = {
            id: Date.now().toString(),
            text: trimmedInput,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);

        try {
            // Send POST request to backend
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: trimmedInput }),
            });

            // Parse response
            const data = await response.json();

            // Extract reply (handle both string and object responses)
            let replyText = '';
            if (typeof data.reply === 'string') {
                replyText = data.reply;
            } else if (data.reply) {
                // If reply is an object/array (e.g., faculty list), format it
                replyText = JSON.stringify(data.reply, null, 2);
            } else if (data.error) {
                replyText = data.error;
            } else {
                replyText = "I received your message but couldn't generate a response.";
            }

            // Create and add bot response
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMsg]);

        } catch (error) {
            // Handle network errors gracefully
            console.error('[Chatbot API Error]:', error);

            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I couldn't connect to the server. Please check your connection and try again.",
                sender: 'bot',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            // Always remove typing indicator
            setIsTyping(false);
        }
    };

    useEffect(() => {
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages, isTyping]);

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.sender === 'user';
        return (
            <View
                style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowBot,
                ]}
            >
                <View
                    style={[
                        styles.bubble,
                        isUser ? styles.userBubble : styles.botBubble,
                    ]}
                >
                    <Text
                        style={[
                            styles.messageText,
                            isUser ? styles.userMessageText : styles.botMessageText,
                        ]}
                    >
                        {item.text}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* Header - Fixed at top, outside KeyboardAvoidingView */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <Image
                        source={require('../assets/images/icon_chatbot.png')}
                        style={styles.headerIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.headerTitle}>Campus Assistant</Text>
                </View>

                {/* Spacer for alignment */}
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.chatList}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={
                        isTyping ? (
                            <View style={styles.typingContainer}>
                                <View style={styles.dot} />
                                <View style={[styles.dot, { marginHorizontal: 4 }]} />
                                <View style={styles.dot} />
                            </View>
                        ) : null
                    }
                />

                {/* Input Area */}
                <View style={styles.inputWrapper}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ask something..."
                            placeholderTextColor={COLORS.placeholder}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={500}
                            selectionColor={COLORS.accent}
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                            onPress={handleSend}
                            disabled={!inputText.trim()}
                        >
                            <Ionicons
                                name="arrow-up"
                                size={20}
                                color={inputText.trim() ? COLORS.background : COLORS.surface}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    keyboardContainer: {
        flex: 1,
    },
    header: {
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
        height: Platform.OS === 'android' ? 100 : 100, // Explicit larger height "code down"
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.headerBorder,
        backgroundColor: COLORS.background,
        marginTop: 20, // Add explicit margin top as requested "goes way top"
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        width: 32,
        height: 32,
        marginRight: 10,
        borderRadius: 8,
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
    chatList: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 20,
        flexGrow: 1,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 20,
        width: '100%',
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    messageRowBot: {
        justifyContent: 'flex-start',
    },
    bubble: {
        maxWidth: '85%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 18,
    },
    userBubble: {
        backgroundColor: COLORS.userBubble,
        borderBottomRightRadius: 4,
    },
    botBubble: {
        backgroundColor: COLORS.botBubble,
        paddingLeft: 0,
        paddingVertical: 0,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '400',
    },
    userMessageText: {
        color: COLORS.textPrimary,
    },
    botMessageText: {
        color: COLORS.textPrimary,
    },
    typingContainer: {
        flexDirection: 'row',
        marginLeft: 0,
        marginTop: 8,
        marginBottom: 20,
        alignItems: 'center',
        height: 24,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.textSecondary,
        opacity: 0.5,
    },
    inputWrapper: {
        width: '100%',
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 12 : 16,
        paddingTop: 12,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.headerBorder,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        paddingHorizontal: 8,
        paddingVertical: 8,
        minHeight: 48,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: 16,
        lineHeight: 20,
        paddingHorizontal: 12,
        paddingTop: Platform.OS === 'ios' ? 8 : 8,
        paddingBottom: Platform.OS === 'ios' ? 8 : 8,
        maxHeight: 120,
    },
    sendButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
        marginBottom: 4,
    },
    sendButtonDisabled: {
        backgroundColor: COLORS.headerBorder,
    },
});
