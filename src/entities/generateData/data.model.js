import mongoose from 'mongoose';

const AdSchema = new mongoose.Schema({
   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who created the ad
  page: {
    pageId: { type: String,  },
    pageName: { type: String,  },
    pageAccessToken: { type: String,  },
    instagramBusinessId: { type: String } // optional
  },
  // ---------- Campaign Info ----------
  campaign: {
    name: { type: String, required: true },
    objective: { type: String, required: true }         // e.g., "TRAFFIC", "CONVERSIONS"
  },

  // ---------- Ad Set ----------
  adSet: {
    name: { type: String, required: true },
    dailyBudget: { type: Number, required: true },      // smallest currency unit
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    targeting: {
      locations: [{ type: String, required: true }],   // country/city names
      ageMin: { type: Number, required: true },
      ageMax: { type: Number, required: true },
      gender: { type: Number, required: true }         // 1=Male, 2=Female, 0=All
    }
  },

  // ---------- Ad Creative ----------
  adCreative: {
    name: { type: String, required: true },
    format: { type: String, required: true },          // "SINGLE_IMAGE", "CAROUSEL", "VIDEO"
    mediaUrls: [{ type: String, required: true }],     // Array of hosted images/videos
    primaryText: { type: String, required: true },
    headline: { type: String, required: true },
    destinationUrl: { type: String, required: true }   // Landing page
  }

}, { timestamps: true });

const Ad = mongoose.models.Ad || mongoose.model('Ad', AdSchema);
export default Ad;
