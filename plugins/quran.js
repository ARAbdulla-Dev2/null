const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/quran.json');

// Utility function to load data
const loadData = () => {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    return {};
};

module.exports = async (query) => {
    const quranData = loadData();
    if (!query) {
        return quranData;
    }

    const results = {};
    const lowerQuery = query.toLowerCase();

    for (const [reciter, surahs] of Object.entries(quranData)) {
        const matchingSurahs = {};

        // Check if the reciter's name matches the query
        if (reciter.toLowerCase().includes(lowerQuery)) {
            results[reciter] = surahs;
            continue;
        }

        // Check if any Surah matches the query
        for (const [surah, url] of Object.entries(surahs)) {
            if (
                surah.toLowerCase().includes(lowerQuery) ||
                `${reciter.toLowerCase()} ${surah.toLowerCase()}`.includes(lowerQuery)
            ) {
                matchingSurahs[surah] = url;
            }
        }

        if (Object.keys(matchingSurahs).length > 0) {
            results[reciter] = matchingSurahs;
        }
    }

    // If no results are found, return "No results"
    if (Object.keys(results).length === 0) {
        return { message: "No results found for your query." };
    }

    return results;
};
