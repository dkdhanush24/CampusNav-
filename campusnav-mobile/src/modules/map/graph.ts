import { PATH_MAIN_TO_CSE } from './path';

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
// IDs map to BUILDINGS in map.tsx where possible
// Internal nodes: 'junction', 'curve'
export const NODES: Record<GraphNodeId, Coordinate> = {
    '1': { latitude: 8.994678336848386, longitude: 76.69581836229666 }, // Main Block
    'junction': { latitude: 8.994809606901748, longitude: 76.69598011313064 },
    '2': { latitude: 8.99486925582077, longitude: 76.69619292116835 }, // Range/Store
    '3': { latitude: 8.994863378658767, longitude: 76.6962820755256 }, // Canteen
    '4': { latitude: 8.994870001718983, longitude: 76.6964081393486 }, // Library
    'curve': { latitude: 8.99517469295072, longitude: 76.69634084332802 },
    '5': { latitude: 8.995398669599032, longitude: 76.69579045545548 }, // BME (Note: Using slightly precise coord from buildings list if different, but path.ts has one too. Let's strictly use path.ts for BME to match curve path)
    '6': { latitude: 8.995359288702888, longitude: 76.69527372372328 }, // CSE
    '7': { latitude: 8.99544828952255, longitude: 76.69528010312696 }, // Mech & Civil
    '8': { latitude: 8.995209641257036, longitude: 76.69477214307679 }, // EEE
};

// Update BME/CSE coordinates to match PATH_MAIN_TO_CSE exactly to ensure smooth lines
// PATH_MAIN_TO_CSE[3] is BME, [4] is CSE
NODES['5'] = { latitude: PATH_MAIN_TO_CSE[3].latitude, longitude: PATH_MAIN_TO_CSE[3].longitude };
NODES['6'] = { latitude: PATH_MAIN_TO_CSE[4].latitude, longitude: PATH_MAIN_TO_CSE[4].longitude };


// --- EDGES ---
// We extract segments from PATH_MAIN_TO_CSE for the curved parts
export const GRAPH_EDGES: GraphEdge[] = [
    // Main -> Junction
    { from: '1', to: 'junction', path: [NODES['1'], NODES['junction']] },

    // Junction -> Store
    { from: 'junction', to: '2', path: [NODES['junction'], NODES['2']] },

    // Junction -> Canteen
    { from: 'junction', to: '3', path: [NODES['junction'], NODES['3']] },

    // Canteen -> Library
    { from: '3', to: '4', path: [NODES['3'], NODES['4']] },

    // Library -> Store
    { from: '4', to: '2', path: [NODES['4'], NODES['2']] },

    // Junction -> Curve
    { from: 'junction', to: 'curve', path: [NODES['junction'], NODES['curve']] },

    // Curve -> BME
    { from: 'curve', to: '5', path: [NODES['curve'], NODES['5']] },

    // BME -> CSE
    { from: '5', to: '6', path: [NODES['5'], NODES['6']] },

    // BME -> Mech/Civil
    { from: '5', to: '7', path: [NODES['5'], NODES['7']] },

    // Mech/Civil -> EEE
    { from: '7', to: '8', path: [NODES['7'], NODES['8']] },
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
            // If the edge path is defined from A->B, and we are going B->A, we technically 
            // might want to reverse it. However, if 'path' is just 2 points (straight line), 
            // it doesn't matter visually for a polyline.
            // If 'path' has internal points (curves), direction matters.
            // For now, our segments are mostly start/end points derived from nodes, 
            // but strictly speaking we should reverse if traversing against definition.

            if (edge.to === u && edge.from === v) {
                // We are traversing v -> u, but edge is u -> v or v -> u?
                // Edge is defined from edge.from to edge.to
                // We are going u -> v (in loop vars), but edge matched as from=v, to=u
                // So we are going against the edge direction.
                segment = [...edge.path].reverse();
            }

            // Add segment to full path. avoid duplicating the join point if possible,
            // but React Native Maps Polyline handles duplicates fine.
            fullPath = [...fullPath, ...segment];
        }
    }
    return fullPath;
};
