const axios = require('axios');
const cheerio = require('cheerio');

// Fetch the final download URLs from a given page
async function fetchDownloadUrls(downloadPageUrl) {
    try {
        const response = await axios.get(downloadPageUrl);
        const $ = cheerio.load(response.data);
        const downloadUrls = {};

        $('div.f').each((_, element) => {
            const resolutionText = $(element).find('a').text().trim();
            const relativeUrl = $(element).find('a').attr('href');
            if (!relativeUrl) return;

            const fullUrl = `https://isaidub9.com${relativeUrl}`;
            const fontText = $(element).find('td.left font').text().trim();

            // Skip sample links
            if (fontText.toLowerCase().includes('sample')) return;

            if (resolutionText.includes("360p")) {
                downloadUrls["360p"] = fullUrl;
            } else if (resolutionText.includes("720p")) {
                downloadUrls["720p"] = fullUrl;
            }
        });

        const finalDownloadUrls = {};
        for (const [quality, qualityUrl] of Object.entries(downloadUrls)) {
            const finalUrl = await fetchFinalUrl(qualityUrl);
            if (finalUrl) finalDownloadUrls[quality] = finalUrl;
        }

        return finalDownloadUrls;
    } catch (error) {
        console.error(`Error fetching download URLs from ${downloadPageUrl}:`, error.message);
        return {};
    }
}

// Fetch the final URL from intermediate links
async function fetchFinalUrl(intermediateUrl) {
    try {
        const response = await axios.get(intermediateUrl);
        const $ = cheerio.load(response.data);

        let finalLink = null;
        $('div.download').each((_, element) => {
            const link = $(element).find('a').attr('href');
            if (link) finalLink = link;
        });

        return finalLink;
    } catch (error) {
        console.error(`Error resolving final URL from ${intermediateUrl}:`, error.message);
        return null;
    }
}

// Fetch nested URLs for a movie
async function fetchNestedUrls(movieUrl, movieTitle) {
    try {
        const response = await axios.get(movieUrl);
        const $ = cheerio.load(response.data);

        const nestedUrls = [];
        $('div.f').each((_, element) => {
            const title = $(element).find('a').text().trim();
            const relativeUrl = $(element).find('a').attr('href');
            if (relativeUrl) {
                nestedUrls.push({
                    title,
                    url: `https://isaidub9.com${relativeUrl}`,
                });
            }
        });

        const movie = { title: movieTitle, downloadUrls: {} };
        for (const { url } of nestedUrls) {
            const finalDownloadUrls = await fetchDownloadUrls(url);
            Object.assign(movie.downloadUrls, finalDownloadUrls);
        }

        return movie;
    } catch (error) {
        console.error(`Error fetching nested URLs from ${movieUrl}:`, error.message);
        return { title: movieTitle, downloadUrls: {} };
    }
}

// Main function to get movies based on a search query
async function getMovies(searchQuery, results) {
    try {
        const baseUrl = 'https://isaidub9.com/movie/hollywood-movies-in-english/';
        const totalPages = 55;
        const movies = [];

        for (let page = 1; page <= totalPages; page++) {
            const pageUrl = `${baseUrl}?get-page=${page}`;
            const response = await axios.get(pageUrl);
            const $ = cheerio.load(response.data);

            const movieLinks = [];
            $('.f').each((_, element) => {
                const title = $(element).find('a').text().trim();
                const relativeUrl = $(element).find('a').attr('href');
                if (relativeUrl && title.toLowerCase().includes(searchQuery.toLowerCase())) {
                    movieLinks.push({
                        title,
                        fullUrl: `https://isaidub9.com${relativeUrl}`,
                    });
                }
            });

            for (const { title, fullUrl } of movieLinks) {
                const movie = await fetchNestedUrls(fullUrl, title);
                if (Object.keys(movie.downloadUrls).length > 0) movies.push(movie);

                if (movies.length >= results) break;
            }

            if (movies.length >= results) break;
        }

        return movies.length > 0 ? movies : { message: 'No movies found' };
    } catch (error) {
        console.error('Error fetching movies:', error.message);
        return { message: 'Failed to fetch or parse data' };
    }
}

// Exported function
module.exports = async (query, results = 6) => {
    if (!query) return { message: 'No query provided.' };

    return await getMovies(query, results);
};
