/**
 * Campus building data — extracted from the mobile app's map.tsx
 * These are the same coordinates used in the React Native application.
 */

export const BUILDINGS = [
    {
        id: '1',
        title: 'Administrative Block',
        description: 'Main Office & Administration',
        icon: '🏛️',
        coords: { lat: 8.994678336848386, lng: 76.69581836229666 },
    },
    {
        id: '2',
        title: 'College Store',
        description: 'Supplies & Stationery',
        icon: '🏪',
        coords: { lat: 8.99486925582077, lng: 76.69619292116835 },
    },
    {
        id: '3',
        title: 'College Canteen',
        description: 'Food Court',
        icon: '🍽️',
        coords: { lat: 8.994863378658767, lng: 76.6962820755256 },
    },
    {
        id: '4',
        title: 'College Library',
        description: 'Books & Reading',
        icon: '📚',
        coords: { lat: 8.994870001718983, lng: 76.6964081393486 },
    },
    {
        id: '5',
        title: 'Biomedical Engineering',
        description: 'BME Department',
        icon: '🧬',
        coords: { lat: 8.995398669599032, lng: 76.69579045545548 },
    },
    {
        id: '6',
        title: 'Computer Science & Engineering',
        description: 'CSE Department',
        icon: '💻',
        coords: { lat: 8.995359288702888, lng: 76.69527372372328 },
    },
    {
        id: '7',
        title: 'Mechanical & Civil Engineering',
        description: 'Mech & Civil Department',
        icon: '⚙️',
        coords: { lat: 8.99544828952255, lng: 76.69528010312696 },
    },
    {
        id: '8',
        title: 'Electrical & Electronics Engineering',
        description: 'EEE Department',
        icon: '⚡',
        coords: { lat: 8.995209641257036, lng: 76.69477214307679 },
    },
];

/**
 * Graph nodes — walking path network nodes from the mobile app's graph.ts
 */
export const GRAPH_NODES = {
    '1': { lat: 8.994678336848386, lng: 76.69581836229666 },
    'junction': { lat: 8.994809606901748, lng: 76.69598011313064 },
    '2': { lat: 8.99486925582077, lng: 76.69619292116835 },
    '3': { lat: 8.994863378658767, lng: 76.6962820755256 },
    '4': { lat: 8.994870001718983, lng: 76.6964081393486 },
    'curve': { lat: 8.99517469295072, lng: 76.69634084332802 },
    '5': { lat: 8.995398669599032, lng: 76.69579045545548 },
    '6': { lat: 8.995359288702888, lng: 76.69527372372328 },
    '7': { lat: 8.99544828952255, lng: 76.69528010312696 },
    '8': { lat: 8.995209641257036, lng: 76.69477214307679 },
};

/**
 * Walking path edges — connects buildings via the campus walkway network
 */
export const WALKING_PATHS = [
    { from: '1', to: 'junction' },
    { from: 'junction', to: '2' },
    { from: 'junction', to: '3' },
    { from: '3', to: '4' },
    { from: '4', to: '2' },
    { from: 'junction', to: 'curve' },
    { from: 'curve', to: '5' },
    { from: '5', to: '6' },
    { from: '5', to: '7' },
    { from: '7', to: '8' },
];

/**
 * Get walking path polyline coordinates for all edges
 */
export function getWalkingPathLines() {
    return WALKING_PATHS.map(edge => [
        [GRAPH_NODES[edge.from].lat, GRAPH_NODES[edge.from].lng],
        [GRAPH_NODES[edge.to].lat, GRAPH_NODES[edge.to].lng],
    ]);
}

/**
 * Department data — from the mobile app's department.ts
 */
export const DEPARTMENTS = {
    ADMIN: {
        name: "Administrative Block",
        rooms: ["A101", "A102", "A103", "A104", "A105"],
    },
    CSE: {
        name: "Computer Science and Engineering",
        rooms: ["D101", "D102", "D103", "CSE_HOD", "COMPUTATION_LAB"],
    },
    BIOMEDICAL: {
        name: "Biomedical Engineering",
        rooms: ["B101", "B102", "B103"],
    },
    MECH_CIVIL: {
        name: "Mechanical and Civil Engineering",
        rooms: ["AI_LAB"],
    },
    EEE: {
        name: "Electrical and Electronics Engineering",
        rooms: ["G101", "G102", "G103"],
    },
};
