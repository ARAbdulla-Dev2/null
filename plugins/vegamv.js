const axios = require('axios');
const cheerio = require('cheerio');

// Utility function to construct full image URLs
const constructImageUrl = (baseUrl, relativeUrl) => (relativeUrl ? `${baseUrl}${relativeUrl}` : null);

// Fetch download links from a movie's detail page
async function getDownloadLinks(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const downloadUrls = {};

        $('h3').each((_, element) => {
            const label = $(element).text().toLowerCase();

            if (label.includes('480p')) {
                downloadUrls['480p'] = $(element).next().find('a').attr('href');
            } else if (label.includes('720p')) {
                downloadUrls['720p'] = $(element).next().find('a').attr('href');
            } else if (label.includes('1080p')) {
                downloadUrls['1080p'] = $(element).next().find('a').attr('href');
            }
        });

        return downloadUrls;
    } catch (error) {
        console.error(`Failed to fetch download links from ${url}`, error);
        return {};
    }
}

// Fetch movies and their details based on a search query
async function getMovies(searchQuery, resultsLimit = 10) {
    if (!searchQuery) {
        return { success: false, message: 'Search query is required' };
    }

    try {
        const baseUrl = 'https://vegamovies.soy';
        const searchURL = baseUrl;

        const response = await axios.post(searchURL, new URLSearchParams({
            do: 'search',
            subaction: 'search',
            story: searchQuery,
        }));

        const $ = cheerio.load(response.data);
        const movieLinks = [];

        // Extract movie details
        $('article.post-item').each((index, element) => {
            if (index >= resultsLimit) return false;

            const title = $(element).find('.entry-title a').text().trim();
            const url = $(element).find('.entry-title a').attr('href');
            const image = $(element).find('.blog-img img').attr('src');
            const date = $(element).find('.date-time span').text().trim();

            if (url) {
                movieLinks.push({
                    title,
                    url,
                    year: date,
                    image: constructImageUrl(baseUrl, image),
                });
            }
        });

        // Fetch download links for each movie
        for (const movie of movieLinks) {
            const downloadUrls = await getDownloadLinks(movie.url);
            movie.downloadUrls = downloadUrls;
        }

        return movieLinks.length > 0
            ? { success: true, results: movieLinks }
            : { success: false, message: 'No movies found' };
    } catch (error) {
        console.error('Error fetching movies:', error);
        return { success: false, message: 'Failed to fetch or parse data' };
    }
}

// Plugin-like exported function
module.exports = async (query, results = 10) => {
    if (!query) {
        return { message: 'No query provided.' };
    }

    const resultsData = await getMovies(query, results);
    return resultsData;
};
