import axios from 'axios';
import User from '../auth/auth.model.js';


// Redirect user to Facebook login
export const getFacebookLoginUrl = async (req, res) => {
  const userId = req.user._id
  const redirectUri = encodeURIComponent(`${process.env.BASE_URL}/api/v1/connect/callback`);
  const clientId = process.env.FACEBOOK_APP_ID;
  const scope = encodeURIComponent('pages_show_list,ads_management,instagram_basic,ads_read,pages_read_engagement');
  
  const fbLoginUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${userId}`;

  res.json({ url: fbLoginUrl }); // Frontend can redirect user to this URL
};

// Handle callback from Facebook
export const facebookCallback = async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    if (!code) return res.status(400).json({ error: 'No code provided by Facebook' });
    if (!userId) return res.status(400).json({ error: 'User ID not provided' });

    // ------------------- Short-lived token -------------------
    const shortLivedRes = await axios.get(
      `https://graph.facebook.com/v17.0/oauth/access_token?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(`${process.env.BASE_URL}/api/v1/connect/callback`)}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&code=${code}`
    );
    const shortLivedToken = shortLivedRes.data.access_token;

    // ------------------- Long-lived token -------------------
    const longLivedRes = await axios.get(
      `https://graph.facebook.com/v17.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.FACEBOOK_APP_ID}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}`
    );
    const longLivedToken = longLivedRes.data.access_token;

    // ------------------- Get all pages -------------------
    const pagesRes = await axios.get(`https://graph.facebook.com/v17.0/me/accounts?access_token=${longLivedToken}`);
    const pages = pagesRes.data.data;
    console.log(pages);
    if (!pages || pages.length === 0) {
      return res.status(400).json({ error: 'No Facebook pages found for this user' });
    }

    // ------------------- Prepare array for sub-schema -------------------
    const facebookPagesData = await Promise.all(
      pages.map(async (page) => {
        let instagramBusinessId = null;
            let adAccountId = null
        try {
          const igRes = await axios.get(
            `https://graph.facebook.com/v17.0/${page.id}?fields=instagram_business_account&access_token=${longLivedToken}`
          );
          instagramBusinessId = igRes.data.instagram_business_account?.id || null;
        } catch (err) {
          console.warn(`No Instagram Business ID for page ${page.id}`);
        }


         // ---------------- Get Ad Account ID ----------------
    try {
      const adAccountsRes = await axios.get(
        `https://graph.facebook.com/v17.0/${page.id}/adaccounts?access_token=${longLivedToken}`
      );
      console.log(adAccountsRes);
      // pick the first ad account (if multiple)
      if (adAccountsRes.data.data && adAccountsRes.data.data.length > 0) {
        adAccountId = adAccountsRes.data.data[0].id;
      }
    } catch (err) {
      console.warn(`No Ad Account for page ${page.id}`);
    }

        return {
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token || longLivedToken, // fallback to long-lived token
          adAccountId, // You can adjust if the ad account ID is different
          instagramBusinessId,
          tasks: page.tasks || []
        };
      })
    );

    // ------------------- Save to user -------------------
    await User.findByIdAndUpdate(userId, {
      facebookPages: facebookPagesData
    });

    res.json({
      message: 'Facebook & Instagram pages connected successfully',
      facebookPages: facebookPagesData
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
};