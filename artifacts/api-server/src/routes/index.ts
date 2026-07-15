import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import residentsRouter from "./residents";
import violationsRouter from "./violations";
import vendorsRouter from "./vendors";
import workOrdersRouter from "./work-orders";
import documentsRouter from "./documents";
import duesRouter from "./dues";
import announcementsRouter from "./announcements";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(residentsRouter);
router.use(violationsRouter);
router.use(vendorsRouter);
router.use(workOrdersRouter);
router.use(documentsRouter);
router.use(duesRouter);
router.use(announcementsRouter);

export default router;
