require("dotenv").config();

const { askRAG } = require("./rag/services/ragService");

(async () => {

    const answer = await askRAG("What is the hostel fee?");

    console.log("\nAI Answer:\n");

    console.log(answer);

})();
