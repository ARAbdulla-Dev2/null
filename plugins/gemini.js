const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize the Gemini model
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

module.exports = async (query) => {
    if (!query) {
        return { message: "No query provided." };
    }

    try {
        // Send the query to the Gemini model
        const result = await model.generateContent([query]);

        // Check if the result contains a response
        if (result && result.response) {
            return {
                query,
                response: result.response.text(), // Return the generated text
            };
        }

        // If no response, return a "No results" message
        return { message: "No results found for your query." };
    } catch (error) {
        console.error("Error in Gemini plugin:", error);
        return { message: "An error occurred while processing your query." };
    }
};
