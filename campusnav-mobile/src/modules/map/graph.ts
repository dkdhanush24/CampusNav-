
// --- TYPE DEFINITIONS ---
export type Coordinate = {
    latitude: number;
    longitude: number;
};

export type GraphNodeId = string;

export type GraphEdge = {
    from: GraphNodeId;
    to: GraphNodeId;
    path: Coordinate[]; // The physical path (polyline) for this edge
};

// --- NODES ---
// Building nodes use numbered IDs for destinations
// Internal waypoints use descriptive IDs (junction_X, curve_X)
export const NODES: Record<GraphNodeId, Coordinate> = {
    // ── Buildings ──
    'admin_block': { latitude: 8.994686086477683, longitude: 76.69582193415592 }, // Administrative Block
    'college_store': { latitude: 8.994848118260679, longitude: 76.69619367233567 }, // College Store
    'canteen': { latitude: 8.994853048554454, longitude: 76.69629256435411 }, // College Canteen
    'library': { latitude: 8.994878337892946, longitude: 76.69638265324195 }, // Library
    'guest_house': { latitude: 8.995306383101553, longitude: 76.69653343359255 }, // Guest House
    'auditorium': { latitude: 8.995571626996732, longitude: 76.69639066416048 }, // Auditorium
    'placement_cell': { latitude: 8.995311008861123, longitude: 76.69615866411749 }, // Placement Cell
    'ft_department': { latitude: 8.994961247431098, longitude: 76.69513357830049 }, // FT Department
    'ground': { latitude: 8.99424760108995, longitude: 76.69544482686769 }, // Ground
    'basketball_court': { latitude: 8.993176062876119, longitude: 76.69477721072724 }, // Basketball Court
    'mosque': { latitude: 8.993135963671726, longitude: 76.69595230534802 }, // Mosque
    'college_gate': { latitude: 8.99286418005222, longitude: 76.69525762369065 }, // College Gate

    // ── Departments (kept same coordinates) ──
    'bme': { latitude: 8.995401201354628, longitude: 76.69578294385585 }, // BME Department
    'cse': { latitude: 8.995359288702888, longitude: 76.69527372372328 }, // CSE Department
    'mech_civil': { latitude: 8.99544828952255, longitude: 76.69528010312696 }, // Mech & Civil Department
    'cs_ai': { latitude: 8.995209641257036, longitude: 76.69477214307679 }, // CS AI Department (was EEE)

    // ── Junctions & Waypoints ──
    'junction_1': { latitude: 8.994735931606956, longitude: 76.69592476252183 }, // Junction 1
    'junction_2': { latitude: 8.994868972295489, longitude: 76.69602514288012 }, // Junction 2
    'junction_3': { latitude: 8.994924233354567, longitude: 76.69615506026211 }, // Junction 3
    'junction_4': { latitude: 8.994830569141001, longitude: 76.69636368716031 }, // Junction 4
    'junction_5': { latitude: 8.995391181736126, longitude: 76.69639855827022 }, // Junction 5
    'junction_6': { latitude: 8.994999118711148, longitude: 76.6958305154214 }, // Junction 6
    'junction_7': { latitude: 8.994024828337906, longitude: 76.69576961309677 }, // Junction 7
    'junction_8': { latitude: 8.993434479869906, longitude: 76.69557789900253 }, // Junction 8
    'junction_9': { latitude: 8.993510222744193, longitude: 76.69545159324748 }, // Junction 9
    'curve_1': { latitude: 8.995161203712977, longitude: 76.6963371346474 }, // Curve Point 1
    'curve_2': { latitude: 8.995293270126952, longitude: 76.69631911686986 }, // Curve Point 2
};


// --- EDGES ---
// Defines the road network connecting all nodes
export const GRAPH_EDGES: GraphEdge[] = [
    // ── Central Campus Road ──
    // Admin Block ↔ Junction 1
    { from: 'admin_block', to: 'junction_1', path: [NODES['admin_block'], NODES['junction_1']] },

    // Junction 1 ↔ Junction 2
    { from: 'junction_1', to: 'junction_2', path: [NODES['junction_1'], NODES['junction_2']] },

    // Junction 2 ↔ Junction 3
    { from: 'junction_2', to: 'junction_3', path: [NODES['junction_2'], NODES['junction_3']] },

    // Junction 2 ↔ Junction 6
    { from: 'junction_2', to: 'junction_6', path: [NODES['junction_2'], NODES['junction_6']] },

    // Junction 2 ↔ College Store
    { from: 'junction_2', to: 'college_store', path: [NODES['junction_2'], NODES['college_store']] },

    // Junction 3 ↔ Junction 4
    { from: 'junction_3', to: 'junction_4', path: [NODES['junction_3'], NODES['junction_4']] },

    // Junction 3 ↔ Curve Point 1
    { from: 'junction_3', to: 'curve_1', path: [NODES['junction_3'], NODES['curve_1']] },

    // Junction 3 ↔ College Canteen
    { from: 'junction_3', to: 'canteen', path: [NODES['junction_3'], NODES['canteen']] },

    // ── Canteen-Library-Store Loop ──
    // Junction 4 ↔ Canteen
    { from: 'junction_4', to: 'canteen', path: [NODES['junction_4'], NODES['canteen']] },

    // Junction 4 ↔ Library
    { from: 'junction_4', to: 'library', path: [NODES['junction_4'], NODES['library']] },

    // Junction 4 ↔ College Store
    { from: 'junction_4', to: 'college_store', path: [NODES['junction_4'], NODES['college_store']] },

    // ── Upper Campus (Departments) ──
    // Junction 6 ↔ FT Department
    { from: 'junction_6', to: 'ft_department', path: [NODES['junction_6'], NODES['ft_department']] },

    // Curve Point 1 ↔ Curve Point 2
    { from: 'curve_1', to: 'curve_2', path: [NODES['curve_1'], NODES['curve_2']] },

    // Curve Point 2 ↔ Junction 5
    { from: 'curve_2', to: 'junction_5', path: [NODES['curve_2'], NODES['junction_5']] },

    // Curve Point 2 ↔ Placement Cell
    { from: 'curve_2', to: 'placement_cell', path: [NODES['curve_2'], NODES['placement_cell']] },

    // Curve Point 2 ↔ BME
    { from: 'curve_2', to: 'bme', path: [NODES['curve_2'], NODES['bme']] },

    // Junction 5 ↔ Guest House
    { from: 'junction_5', to: 'guest_house', path: [NODES['junction_5'], NODES['guest_house']] },

    // Junction 5 ↔ Auditorium
    { from: 'junction_5', to: 'auditorium', path: [NODES['junction_5'], NODES['auditorium']] },

    // BME ↔ CSE
    { from: 'bme', to: 'cse', path: [NODES['bme'], NODES['cse']] },

    // BME ↔ Mech/Civil
    { from: 'bme', to: 'mech_civil', path: [NODES['bme'], NODES['mech_civil']] },

    // Mech/Civil ↔ CS AI
    { from: 'mech_civil', to: 'cs_ai', path: [NODES['mech_civil'], NODES['cs_ai']] },

    // ── Southern Campus ──
    // Junction 7 ↔ Administrative Block
    { from: 'junction_7', to: 'admin_block', path: [NODES['junction_7'], NODES['admin_block']] },

    // Junction 8 ↔ Junction 7
    { from: 'junction_8', to: 'junction_7', path: [NODES['junction_8'], NODES['junction_7']] },

    // Junction 9 ↔ Junction 8
    { from: 'junction_9', to: 'junction_8', path: [NODES['junction_9'], NODES['junction_8']] },

    // Junction 9 ↔ Ground
    { from: 'junction_9', to: 'ground', path: [NODES['junction_9'], NODES['ground']] },

    // Junction 9 ↔ Basketball Court
    { from: 'junction_9', to: 'basketball_court', path: [NODES['junction_9'], NODES['basketball_court']] },

    // Junction 8 ↔ College Gate
    { from: 'junction_8', to: 'college_gate', path: [NODES['junction_8'], NODES['college_gate']] },

    // Junction 8 ↔ Mosque
    { from: 'junction_8', to: 'mosque', path: [NODES['junction_8'], NODES['mosque']] },
];

/**
 * Simple BFS to find a path between two nodes.
 * Returns an array of Coordinates representing the continuous polyline.
 */
export const findGraphPath = (startId: string, endId: string): Coordinate[] => {
    if (startId === endId) return [NODES[startId]];

    const queue: { id: string; path: string[] }[] = [{ id: startId, path: [startId] }];
    const visited = new Set<string>();
    visited.add(startId);

    while (queue.length > 0) {
        const { id, path } = queue.shift()!;

        if (id === endId) {
            return constructPolyline(path);
        }

        // Find neighbors
        const neighbors = getNeighbors(id);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ id: neighbor, path: [...path, neighbor] });
            }
        }
    }

    return []; // No path found
};

const getNeighbors = (nodeId: string): string[] => {
    const neighbors: string[] = [];
    GRAPH_EDGES.forEach(edge => {
        if (edge.from === nodeId) neighbors.push(edge.to);
        if (edge.to === nodeId) neighbors.push(edge.from);
    });
    return neighbors;
};

const constructPolyline = (nodeSequence: string[]): Coordinate[] => {
    let fullPath: Coordinate[] = [];

    for (let i = 0; i < nodeSequence.length - 1; i++) {
        const u = nodeSequence[i];
        const v = nodeSequence[i + 1];

        const edge = GRAPH_EDGES.find(
            e => (e.from === u && e.to === v) || (e.from === v && e.to === u)
        );

        if (edge) {
            let segment = edge.path;
            if (edge.to === u && edge.from === v) {
                segment = [...edge.path].reverse();
            }

            fullPath = [...fullPath, ...segment];
        }
    }
    return fullPath;
};
