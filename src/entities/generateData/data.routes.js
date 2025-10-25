import express from 'express';
import { generateAd, saveAd } from './data.controller.js';


const router = express.Router();

// POST /api/generate-ad
router.post('/generate-ad', generateAd);

router.post('/save', saveAd);

export default router;
