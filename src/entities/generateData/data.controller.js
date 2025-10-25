import { crawlWebsite } from '../../lib/crawler.js';
import OpenAI from 'openai';

import Ad from './data.model.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateAd = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Website URL is required' });

    // 1️⃣ Crawl the website
    const crawledData = await crawlWebsite(url);

    // 2️⃣ Prepare prompt for GPT
    const prompt = `
You are an expert Facebook/Instagram ad copywriter.
Generate the mandatory ad data for a campaign based on the following website info:

Title: ${crawledData.title}
Description: ${crawledData.description}
Headings: ${crawledData.headings.join(', ')}
Links: ${crawledData.links.join(', ')}

Generate JSON output ONLY with the following mandatory fields:

{
  "campaign": {
    "name": "string",
    "objective": "string"
  },
  "adSet": {
    "name": "string",
    "dailyBudget": 0,
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "targeting": {
      "locations": ["country/city"],
      "ageMin": 18,
      "ageMax": 60,
      "gender": 0
    }
  },
  "adCreative": {
    "name": "string",
    "format": "SINGLE_IMAGE",
    "mediaUrls": ["url"],
    "primaryText": "string",
    "headline": "string",
    "destinationUrl": "string"
  }
}
Only return valid JSON, no explanations.
`;

    // 3️⃣ Call GPT API (v4+ SDK)
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const generatedText = response.choices[0].message.content;

    // 4️⃣ Parse JSON
    let adData;
    try {
      adData = JSON.parse(generatedText);
    } catch (err) {
      return res.status(500).json({ 
        error: 'GPT did not return valid JSON', 
        raw: generatedText 
      });
    }

    
    

    res.json({ crawledData, adData});

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};




export const saveAd = async (req, res) => {
  try {
    const adData = req.body;

    // Save to DB
    const ad = await Ad.create(adData);
    res.status(201).json({ message: 'Ad saved successfully', ad });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
