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

    // Exchange code for short-lived token
    const shortLivedRes = await axios.get(
      `https://graph.facebook.com/v17.0/oauth/access_token?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(`${process.env.BASE_URL}/api/v1/connect/callback`)}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&code=${code}`
    );

    const shortLivedToken = shortLivedRes.data.access_token;

    // Exchange short-lived token for long-lived token
    const longLivedRes = await axios.get(
      `https://graph.facebook.com/v17.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.FACEBOOK_APP_ID}` +
      `&client_secret=${process.env.FACEBOOK_APP_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}`
    );

    const longLivedToken = longLivedRes.data.access_token;

    // Get pages the user manages
    const pagesRes = await axios.get(`https://graph.facebook.com/v17.0/me/accounts?access_token=${longLivedToken}`);
    console.log(pagesRes.data);

    const pages = pagesRes.data.data;
if (!pages || pages.length === 0) {
  return res.status(400).json({ error: 'No Facebook pages found for this user' });
}

const page = pages[0];


    // Get Instagram Business ID linked to page
    const igRes = await axios.get(
      `https://graph.facebook.com/v17.0/${page.id}?fields=instagram_business_account&access_token=${longLivedToken}`
    );

    const instagramBusinessId = igRes.data.instagram_business_account?.id || null;

    // Save tokens & IDs to user model
    // Assuming you have auth middleware
    await User.findByIdAndUpdate(userId, {
      pageAccessToken: longLivedToken,
      adAccountId: page.id,
      instagramBusinessId,
    });

    res.json({
      message: 'Facebook & Instagram connected successfully',
      page,
      instagramBusinessId,
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
};
