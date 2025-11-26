import express from "express";
import { createCampaign } from "./final.controller.js";



const router = express.Router()

router.post('/create-campaign',createCampaign)

export default router