import express from "express";
import { createCampaign } from "./final.controller.js";
import { userAdminMiddleware, verifyToken } from "../../core/middlewares/authMiddleware.js";
import { createAdSet } from "./adSet.controller.js";



const router = express.Router()

router.post('/create-campaign',verifyToken,userAdminMiddleware,createCampaign)
router.post('/create-adSet',createAdSet)
export default router