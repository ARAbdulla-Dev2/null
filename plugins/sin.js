const axios = require("axios");
const cheerio = require("cheerio");

// Function to convert resolution to a common format (360p, 480p, 720p, etc.)
function getResolution(resolutionText) {
  const [width, height] = resolutionText.split("x").map(Number);
  if (!width || !height) return resolutionText; // Return as is if parsing fails
  if (height <= 360) return "360p";
  if (height <= 480) return "480p";
  if (height <= 720) return "720p";
  if (height <= 1080) return "1080p";
  return `${height}p`; // Return height as resolution for uncommon cases
}

async function scrapeBlog(query) {
  const baseURL = "https://pupilvideo.blogspot.com";
  const searchURL = `${baseURL}/search?q=${query}`;

  const results = [];

  try {
    // Step 1: Search the blog
    const searchResponse = await axios.get(searchURL);
    const $ = cheerio.load(searchResponse.data);

    // Step 2: Extract search results
    const articles = [];
    $(".hentry").each((i, el) => {
      const postURL = $(el).find(".post-title a").attr("href");
      if (postURL) {
        articles.push(postURL);
      }
    });

    // Step 3: Visit each link and extract details
    for (const postURL of articles) {
      try {
        const postResponse = await axios.get(postURL);
        const $$ = cheerio.load(postResponse.data);

        const thumbnail = $$("meta[property='og:image']").attr("content") || ""; // Get thumbnail image
        const downloadLinks = [];

        // Extract download links
        $$(".dlBox a.button").each((i, link) => {
          const downloadURL = $$(link).attr("href");
          if (downloadURL && !downloadURL.includes("t.me")) {
            downloadLinks.push(downloadURL);
          }
        });

        // Fetch details for each valid download link
        for (const downloadURL of downloadLinks) {
          try {
            const fileResponse = await axios.get(downloadURL);
            const $$$ = cheerio.load(fileResponse.data);

            const title = $$$(".video-info p:contains('Title:')").text().replace("Title:", "").trim();
            const size = $$$(".video-info p:contains('Size:')").text().replace("Size:", "").trim();
            const rawResolution = $$$(".video-info p:contains('Resolution:')").text().replace("Resolution:", "").trim();
            const resolution = getResolution(rawResolution); // Convert resolution format
            const finalDownloadLink = $$$(".video-info a.button[href*='download=true']").attr("href");

            const fullDownloadLink = new URL(finalDownloadLink, downloadURL).href;

            results.push({
              title,
              thumbnail,
              size,
              resolution,
              finalDownloadLink: fullDownloadLink,
            });
          } catch (fileError) {
            console.error(`Error fetching file details from ${downloadURL}:`, fileError.message);
          }
        }
      } catch (postError) {
        console.error(`Error fetching post details from ${postURL}:`, postError.message);
      }
    }

    
    return results;
  } catch (error) {
    console.error("Error during scraping:", error.message);
    return { error: "An error occurred during scraping. Please check the logs for details." };
  }
}

// Plugin-like exported function
module.exports = async (query) => {
	if (!query) {
		return { message: 'No query provided.' };
	}

	const resultsData = await scrapeBlog(query);
	return resultsData;
};