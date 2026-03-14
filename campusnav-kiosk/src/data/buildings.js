/**
 * Campus building data — extracted from the mobile app's map.tsx
 * These are the same coordinates used in the React Native application.
 */

export const BUILDINGS = [
    { id: 'admin_block', title: 'Administrative Block', description: 'Main Office', icon: '🏛️', coords: { lat: 8.994686086477683, lng: 76.69582193415592 } },
    { id: 'college_store', title: 'College Store', description: 'Supplies & Stationery', icon: '🏪', coords: { lat: 8.994848118260679, lng: 76.69619367233567 } },
    { id: 'canteen', title: 'College Canteen', description: 'Food Court', icon: '🍽️', coords: { lat: 8.994853048554454, lng: 76.69629256435411 } },
    { id: 'library', title: 'College Library', description: 'Books & Reading', icon: '📚', coords: { lat: 8.994878337892946, lng: 76.69638265324195 } },
    { id: 'bme', title: 'Biomedical Engineering', description: 'BME Dept', icon: '🧬', coords: { lat: 8.995401201354628, lng: 76.69578294385585 } },
    { id: 'cse', title: 'Computer Science & Engineering', description: 'CSE Dept', icon: '💻', coords: { lat: 8.995359288702888, lng: 76.69527372372328 } },
    { id: 'mech_civil', title: 'Mechanical & Civil Engineering', description: 'Mech & Civil Dept', icon: '⚙️', coords: { lat: 8.99544828952255, lng: 76.69528010312696 } },
    { id: 'cs_ai', title: 'CS & AI Department', description: 'Computer Science & AI', icon: '🤖', coords: { lat: 8.995209641257036, lng: 76.69477214307679 } },
    { id: 'guest_house', title: 'Guest House', description: 'Guest Accommodation', icon: '🏠', coords: { lat: 8.995306383101553, lng: 76.69653343359255 } },
    { id: 'auditorium', title: 'Auditorium', description: 'Events & Seminars', icon: '🎤', coords: { lat: 8.995571626996732, lng: 76.69639066416048 } },
    { id: 'placement_cell', title: 'Placement Cell', description: 'Career & Placements', icon: '💼', coords: { lat: 8.995311008861123, lng: 76.69615866411749 } },
    { id: 'ft_department', title: 'FT Department', description: 'Food Technology', icon: '🔬', coords: { lat: 8.994961247431098, lng: 76.69513357830049 } },
    { id: 'ground', title: 'Ground', description: 'Sports Ground', icon: '⚽', coords: { lat: 8.99424760108995, lng: 76.69544482686769 } },
    { id: 'basketball_court', title: 'Basketball Court', description: 'Outdoor Court', icon: '🏀', coords: { lat: 8.993176062876119, lng: 76.69477721072724 } },
    { id: 'mosque', title: 'Mosque', description: 'Prayer Hall', icon: '🕌', coords: { lat: 8.993135963671726, lng: 76.69595230534802 } },
    { id: 'college_gate', title: 'College Gate', description: 'Main Entrance', icon: '⛩️', coords: { lat: 8.99286418005222, lng: 76.69525762369065 } },
];

/**
 * Graph nodes — walking path network nodes from the mobile app's graph.ts
 */
export const GRAPH_NODES = {
    // ── Buildings ──
    'admin_block': { lat: 8.994686086477683, lng: 76.69582193415592 },
    'college_store': { lat: 8.994848118260679, lng: 76.69619367233567 },
    'canteen': { lat: 8.994853048554454, lng: 76.69629256435411 },
    'library': { lat: 8.994878337892946, lng: 76.69638265324195 },
    'guest_house': { lat: 8.995306383101553, lng: 76.69653343359255 },
    'auditorium': { lat: 8.995571626996732, lng: 76.69639066416048 },
    'placement_cell': { lat: 8.995311008861123, lng: 76.69615866411749 },
    'ft_department': { lat: 8.994961247431098, lng: 76.69513357830049 },
    'ground': { lat: 8.99424760108995, lng: 76.69544482686769 },
    'basketball_court': { lat: 8.993176062876119, lng: 76.69477721072724 },
    'mosque': { lat: 8.993135963671726, lng: 76.69595230534802 },
    'college_gate': { lat: 8.99286418005222, lng: 76.69525762369065 },
    'bme': { lat: 8.995401201354628, lng: 76.69578294385585 },
    'cse': { lat: 8.995359288702888, lng: 76.69527372372328 },
    'mech_civil': { lat: 8.99544828952255, lng: 76.69528010312696 },
    'cs_ai': { lat: 8.995209641257036, lng: 76.69477214307679 },

    // ── Junctions & Waypoints ──
    'junction_1': { lat: 8.994735931606956, lng: 76.69592476252183 },
    'junction_2': { lat: 8.994868972295489, lng: 76.69602514288012 },
    'junction_3': { lat: 8.994924233354567, lng: 76.69615506026211 },
    'junction_4': { lat: 8.994830569141001, lng: 76.69636368716031 },
    'junction_5': { lat: 8.995391181736126, lng: 76.69639855827022 },
    'junction_6': { lat: 8.994999118711148, lng: 76.6958305154214 },
    'junction_7': { lat: 8.994024828337906, lng: 76.69576961309677 },
    'junction_8': { lat: 8.993434479869906, lng: 76.69557789900253 },
    'junction_9': { lat: 8.993510222744193, lng: 76.69545159324748 },
    'curve_1': { lat: 8.995161203712977, lng: 76.6963371346474 },
    'curve_2': { lat: 8.995293270126952, lng: 76.69631911686986 },
};

/**
 * Walking path edges — connects buildings via the campus walkway network
 */
export const WALKING_PATHS = [
    // ── Central Campus Road ──
    { from: 'admin_block', to: 'junction_1' },
    { from: 'junction_1', to: 'junction_2' },
    { from: 'junction_2', to: 'junction_3' },
    { from: 'junction_2', to: 'junction_6' },
    { from: 'junction_2', to: 'college_store' },
    { from: 'junction_3', to: 'junction_4' },
    { from: 'junction_3', to: 'curve_1' },
    { from: 'junction_3', to: 'canteen' },
    // ── Canteen-Library-Store Loop ──
    { from: 'junction_4', to: 'canteen' },
    { from: 'junction_4', to: 'library' },
    { from: 'junction_4', to: 'college_store' },
    // ── Upper Campus (Departments) ──
    { from: 'junction_6', to: 'ft_department' },
    { from: 'curve_1', to: 'curve_2' },
    { from: 'curve_2', to: 'junction_5' },
    { from: 'curve_2', to: 'placement_cell' },
    { from: 'curve_2', to: 'bme' },
    { from: 'junction_5', to: 'guest_house' },
    { from: 'junction_5', to: 'auditorium' },
    { from: 'bme', to: 'cse' },
    { from: 'bme', to: 'mech_civil' },
    { from: 'mech_civil', to: 'cs_ai' },
    // ── Southern Campus ──
    { from: 'junction_7', to: 'admin_block' },
    { from: 'junction_8', to: 'junction_7' },
    { from: 'junction_9', to: 'junction_8' },
    { from: 'junction_9', to: 'ground' },
    { from: 'junction_9', to: 'basketball_court' },
    { from: 'junction_8', to: 'college_gate' },
    { from: 'junction_8', to: 'mosque' },
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
        rooms: [
            "PRINCIPAL_OFFICE",
            "COLLEGE_OFFICE",
            "SEMINAR_HALL",
            "DRAWING_HALL",
            "A207",
            "A208",
            "A209",
            "A210",
            "A211"
        ],
    },
    CSE: {
        name: "Computer Science and Engineering",
        rooms: ["D101", "D102", "D103", "CSE_HOD", "COMPUTATION_LAB"],
    },
    BIOMEDICAL: {
        name: "Biomedical Engineering",
        rooms: ["B101", "B102", "B103", "B104", "DISSECTION_LAB"],
    },
    MECH_CIVIL: {
        name: "Mechanical and Civil Engineering",
        rooms: ["AI_LAB", "E202", "E203", "E204", "M202", "M203", "M204"],
    },
    CS_AI: {
        name: "Computer Science and Artificial Intelligence",
        rooms: ["G101", "G102", "G103", "G104", "LANGUAGE_LAB"],
    },
    FT: {
        name: "Food Technology",
        rooms: ["S101", "S102", "S103", "S104", "FT_DRAWING_HALL"],
    }
};
