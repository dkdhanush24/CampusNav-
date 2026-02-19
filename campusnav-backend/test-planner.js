require("dotenv").config();
const { generateQueryPlan } = require("./services/llmService");

const testQueries = [
    "how many faculty in CSE",
    "who is nijil sir",
    "what is the capital of france",
];

(async () => {
    for (const q of testQueries) {
        console.log(`\nQ: "${q}"`);
        try {
            const plan = await generateQueryPlan(q);
            console.log(`→ intent: ${plan.intent}`);
            console.log(`→ operation: ${plan.operation || "-"}`);
            console.log(`→ collection: ${plan.collection || "-"}`);
            console.log(`→ filter: ${JSON.stringify(plan.filter || {})}`);
        } catch (e) {
            console.log(`→ ERROR: ${e.message.substring(0, 100)}`);
        }
        await new Promise(r => setTimeout(r, 5000)); // 5s gap
    }
    process.exit(0);
})();
