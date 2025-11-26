import express from "express";
import { createCampaign } from "./final.controller.js";
import { userAdminMiddleware, verifyToken } from "../../core/middlewares/authMiddleware.js";



const router = express.Router()

router.post('/create-campaign',verifyToken,userAdminMiddleware,createCampaign)

export default router