import express from"express"
const router=express.Router();
import Schedule from "../models/schedule.js";
import authenticate from "../middlewares/auth.js";
import { checkmanager } from "../middlewares/roles.js";
import Stage from "../models/stages.js";
import Match from "../models/matches.js";
import Team from "../models/team.js";
import auth from "../middlewares/auth.js";
import matches from "../models/matches.js";
router.get(
  "/available-teams/:scheduleId",
  authenticate,
  async (req, res) => {
    try {

      const { scheduleId } = req.params;

      const schedule = await Schedule.findById(scheduleId);

      if (!schedule) {
        return res.status(404).json({
          message: "Schedule not found"
        });
      }

      const eventId = schedule.eventid;

      const allTeams = await Team.find({
        eventid: eventId,
        isRegistered: true
      }).select("teamname");

      const matches = await Match.find({
        scheduleid: scheduleId
      });

      const usedTeamIds = new Set();

      matches.forEach(match => {

        if (match.teamA?.teamId) {
          usedTeamIds.add(
            match.teamA.teamId.toString()
          );
        }

        if (match.teamB?.teamId) {
          usedTeamIds.add(
            match.teamB.teamId.toString()
          );
        }

      });

      const availableTeams =
        allTeams.filter(
          team =>
            !usedTeamIds.has(
              team._id.toString()
            )
        );

      return res.status(200).json({
        teams: availableTeams
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message: "Server Error"
      });
    }
  }
);
router.get("/all/:eventid",authenticate,async(req,res)=>{
  try {
    const {eventid}=req.params;
   const matches = await Match.find({
  eventid,
  status: { $ne: "finished" }
})
.populate("teamA.teamId", "teamname")
.populate("teamB.teamId", "teamname");
    return res.status(200).json({
      message:"all matches",
    matches
    })
  } catch (error) {
    console.log(error);
  }
})
router.post(
  "/create",
  authenticate,
  checkmanager,
  async (req, res) => {
    try {

      const {
        eventid,
        scheduleid,
        teamA,
        teamB,
        slotIndex,
        matchType
      } = req.body;
   const schedule =
        await Schedule.findById(scheduleid);

    if(!schedule) return res.status(404).json({message:"schedule not found"});
     
      const match =
        await Match.create({
          eventid,
          scheduleid,

          slotIndex,

          matchType,

          teamA: {
            teamId: teamA
          },

          teamB: {
            teamId: teamB
          },

          rounds: [
            {
              roundNo: 1
            }
          ]
        });

        schedule.matches.push(match._id);
        await schedule.save();
      

      return res.status(201).json({
        message: "Match created",
        match
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.get(
  "/schedule/:scheduleId",
  async (req, res) => {
    try {

      const matches = await Match.find({
        scheduleid: req.params.scheduleId
      })
        .populate(
          "teamA.teamId",
          "teamname members"
        )
        .populate(
          "teamB.teamId",
          "teamname members"
        )
        .sort({ slotIndex: 1 });

      return res.status(200).json({
        matches
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.get("/:matchId", async (req, res) => {
  try {

    const match = await Match.findById(
      req.params.matchId
    )
      .populate("teamA.teamId")
      .populate("teamB.teamId")
      .populate("winner");

    if (!match) {
      return res.status(404).json({
        message: "Match not found"
      });
    }

    return res.json(match);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Server error"
    });
  }
});

router.put(
  "/:matchId/start",
  authenticate,
  checkmanager,
  async (req, res) => {
    try {

      const match =
        await Match.findById(req.params.matchId);

      if (!match) {
        return res.status(404).json({
          message: "Match not found"
        });
      }

      match.status = "live";

      await match.save();

      return res.json({
        message: "Match started"
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);


router.put(
  "/:matchId/score",
  authenticate,
  checkmanager,
  async (req, res) => {
    try {

      const {
        teamA_score,
        teamB_score
      } = req.body;

      const match =
        await Match.findById(req.params.matchId);

      if (!match) {
        return res.status(404).json({
          message: "Match not found"
        });
      }

      match.rounds[0].teamA_score =
        teamA_score;

      match.rounds[0].teamB_score =
        teamB_score;

      await match.save();

      return res.json({
        message: "Score updated"
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.put(
  "/:matchId/finish",
  authenticate,
  checkmanager,
  async (req, res) => {
    try {

      const match =
        await Match.findById(req.params.matchId);

      if (!match) {
        return res.status(404).json({
          message: "Match not found"
        });
      }

      const round = match.rounds[0];

      if (
        round.teamA_score >
        round.teamB_score
      ) {
        match.winner =
          match.teamA.teamId;
      } else if (
        round.teamB_score >
        round.teamA_score
      ) {
        match.winner =
          match.teamB.teamId;
      } else {
        match.isDraw = true;
      }

      match.status = "finished";

      await match.save();

      return res.json({
        message: "Match finished",
        winner: match.winner
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);

router.delete(
  "/:matchId",
  authenticate,
  checkmanager,
  async (req, res) => {
    try {

      const match =
        await Match.findById(req.params.matchId);

      if (!match) {
        return res.status(404).json({
          message: "Match not found"
        });
      }

      await Schedule.findByIdAndUpdate(
        match.scheduleid,
        {
          $pull: {
            matches: match._id
          }
        }
      );

      await Match.findByIdAndDelete(
        match._id
      );

      return res.json({
        message: "Match deleted"
      });

    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message: "Server error"
      });
    }
  }
);
export default router;