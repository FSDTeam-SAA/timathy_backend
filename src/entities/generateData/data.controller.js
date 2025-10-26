import { crawlWebsite } from '../../lib/crawler.js';
import OpenAI from 'openai';

import Ad from './data.model.js';
import { cloudinaryUpload } from '../../lib/cloudinaryUpload.js';

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




// Create ad and save in DB with Cloudinary upload
export const createAd = async (req, res) => {
  try {
    const userId = req.user._id;
   // Parse JSON fields from form-data
    const campaign = JSON.parse(req.body.campaign);
    const adSet = JSON.parse(req.body.adSet);
    const adCreative = JSON.parse(req.body.adCreative);

    // Upload files if provided
     // Upload files if provided
    let uploadedUrls = [];
    if (req.files && req.files.ads && req.files.ads.length > 0) {
      for (let file of req.files.ads) {
        const uploaded = await cloudinaryUpload(file.path, file.filename, 'ads');
        if (uploaded !== 'file upload failed') {
          uploadedUrls.push(uploaded.secure_url);
        }
      }
    }

    // Merge uploaded URLs into adCreative.mediaUrls
    if (!adCreative.mediaUrls) adCreative.mediaUrls = [];
    adCreative.mediaUrls.push(...uploadedUrls);

    const newAd = await Ad.create({
      campaign,
      adSet,
      adCreative,
      userId: req.user._id
    });

    res.json({
      message: 'Ad created successfully',
      ad: newAd
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


export const getAllAds = async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 }); // newest first
    res.json({
      message: 'Ads fetched successfully',
      ads
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// ---------------- Get ad by ID ----------------
export const getAdById = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findById(id);

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    res.json({
      message: 'Ad fetched successfully',
      ad
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};