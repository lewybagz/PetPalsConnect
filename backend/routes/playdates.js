const express = require("express");
const router = express.Router();
const PlaydateController = require("../controllers/PlaydateController");

// Static paths before parameterised ones. "/upcoming" and "/past" were declared
// after "/:id", so both were swallowed and returned a cast error instead.
router.get("/", PlaydateController.getAllPlaydates);
router.get("/upcoming", PlaydateController.getUpcomingPlaydates);
router.get("/user", PlaydateController.getUserPlaydates);
router.get("/locations/:placeId", PlaydateController.getLocationDetails);

router.post("/", PlaydateController.createPlaydate);
router.post("/accept/:playdateId", PlaydateController.acceptPlaydate);
router.post("/decline/:playdateId", PlaydateController.declinePlaydate);

router.patch("/:playdateId/cancel", PlaydateController.cancelPlaydate);
router.patch("/:playdateId/update", PlaydateController.updatePlaydateDetails);
router.get("/:id", PlaydateController.getPlaydateById);

module.exports = router;
