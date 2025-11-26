import axios from 'axios';
import qs from 'querystring';

import User from '../auth/auth.model.js';
import facebookAdModel from './facebookAd.model.js';
import Ad from '../generateData/data.model.js';
const FB = (path) =>
  `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION || 'v17.0'}/${path}`;

export const publishAd = async (req, res) => {
  try {
    const userId = req.user._id;
    const { adId, adAccountId, pageId } = req.body;

    if (!adId || !adAccountId || !pageId) {
      return res
        .status(400)
        .json({ error: 'adId, adAccountId and pageId are required' });
    }

    // Fetch ad draft
    const ad = await Ad.findById(adId);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    // Get page access token
    const user = await User.findById(userId);
    if (!user?.facebookBusinesses) {
      return res
        .status(400)
        .json({ error: 'User has not connected Facebook' });
    }

    const page = user.facebookBusinesses
      .flatMap((b) => b.pages || [])
      .find((p) => p.pageId === pageId);

    if (!page?.pageAccessToken) {
      return res.status(400).json({
        error:
          'Page access token not found. Ask user to reconnect Facebook or choose a different page.',
      });
    }

    const pageAccessToken = page.pageAccessToken;
    const actId = adAccountId.toString().startsWith('act_')
      ? adAccountId
      : `act_${adAccountId}`;

    if (!ad.adCreative?.mediaUrls?.length) {
      return res
        .status(400)
        .json({ error: 'No mediaUrls found in adCreative' });
    }

    const imageUrl = ad.adCreative.mediaUrls[0];

    // Upload image to Facebook
    const uploadRes = await axios.post(
      FB(`${actId}/adimages`),
      qs.stringify({ url: imageUrl }),
      { params: { access_token: pageAccessToken }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const imageHash =
      uploadRes.data?.images &&
      Object.values(uploadRes.data.images)[0]?.hash;

    if (!imageHash)
      return res
        .status(500)
        .json({ error: 'Failed to upload image to Facebook', raw: uploadRes.data });

    // Create Campaign
    const campaignName = ad.campaign.name || `${ad.campaign.objective}-${Date.now()}`;
    const createCampaignRes = await axios.post(
      FB(`${actId}/campaigns`),
      qs.stringify({
        name: campaignName,
        objective: ad.campaign.objective || 'LINK_CLICKS',
        status: 'PAUSED',
      }),
      { params: { access_token: pageAccessToken }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const fbCampaignId = createCampaignRes.data.id;

    // Create Ad Set
    const dailyBudgetCents = Math.round((ad.adSet.dailyBudget || 0) * 100);
    const startTime = new Date().toISOString();
    const endTime = new Date(ad.adSet.endDate).toISOString();

    const targeting = {
      geo_locations: { countries: (ad.adSet.targeting.locations || []).filter(l => l.length === 2).map(l => l.toUpperCase()) },
      age_min: ad.adSet.targeting.ageMin || 18,
      age_max: ad.adSet.targeting.ageMax || 65,
      genders: ad.adSet.targeting.gender ? [ad.adSet.targeting.gender] : [],
    };

    const createAdSetRes = await axios.post(
      FB(`${actId}/adsets`),
      qs.stringify({
        name: ad.adSet.name,
        campaign_id: fbCampaignId,
        daily_budget: dailyBudgetCents.toString(),
        start_time: startTime,
        end_time: endTime,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: JSON.stringify(targeting),
        status: 'PAUSED',
      }),
      { params: { access_token: pageAccessToken }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const fbAdSetId = createAdSetRes.data.id;

    // Create Ad Creative
    const objectStorySpec = {
      page_id: pageId,
      link_data: {
        message: ad.adCreative.primaryText,
        link: ad.adCreative.destinationUrl,
        image_hash: imageHash,
        name: ad.adCreative.headline,
        call_to_action: { type: 'LEARN_MORE', value: { link: ad.adCreative.destinationUrl } },
      },
    };

    const createCreativeRes = await axios.post(
      FB(`${actId}/adcreatives`),
      qs.stringify({
        name: ad.adCreative.name,
        object_story_spec: JSON.stringify(objectStorySpec),
      }),
      { params: { access_token: pageAccessToken }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const fbAdCreativeId = createCreativeRes.data.id;

    // Create Ad
    const createAdRes = await axios.post(
      FB(`${actId}/ads`),
      qs.stringify({
        name: ad.adCreative.name,
        adset_id: fbAdSetId,
        creative: JSON.stringify({ creative_id: fbAdCreativeId }),
        status: 'PAUSED',
      }),
      { params: { access_token: pageAccessToken }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const fbAdId = createAdRes.data.id;

    // Save into FacebookAd model
    const fbAd = new facebookAdModel({
      userId,
      adAccountId,
      page: { pageId, pageName: page.pageName },
      campaign: { name: ad.campaign.name, objective: ad.campaign.objective, fbCampaignId, status: 'PAUSED' },
      adSet: {
        name: ad.adSet.name,
        fbAdSetId,
        dailyBudget: ad.adSet.dailyBudget,
        startDate: ad.adSet.startDate,
        endDate: ad.adSet.endDate,
        targeting: ad.adSet.targeting,
      },
      adCreative: {
        name: ad.adCreative.name,
        fbAdCreativeId,
        headline: ad.adCreative.headline,
        primaryText: ad.adCreative.primaryText,
        destinationUrl: ad.adCreative.destinationUrl,
        mediaUrls: ad.adCreative.mediaUrls,
      },
      fbAdId,
      status: 'PUBLISHED',
      lastSyncedAt: new Date(),
    });

    await fbAd.save();

    return res.json({
      message: 'Ad published to Facebook (paused).',
      fb: { campaignId: fbCampaignId, adSetId: fbAdSetId, adCreativeId: fbAdCreativeId, adId: fbAdId },
      ad: fbAd,
    });
  } catch (err) {
    console.error('publishAd error:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'Failed to publish ad',
      detail: err.response?.data || err.message,
    });
  }
};
