import express from "express";
import User from "../models/user.js";
import Club from "../models/club.js";
import Event from "../models/events.js";
import authenticate from "../middlewares/auth.js";
import Match from "../models/matches.js";
import mongoose from "mongoose";
import Team from "../models/team.js";
import Schedule from "../models/schedule.js";
import {checkadmin,checkmanager} from "../middlewares/roles.js";
import QueryMessage from "../models/QueryMessage.js";
import Stage from "../models/stages.js";
import { emitMatchEvent } from "../utils/emitMatchUpdate.js";
import schedule from "../models/schedule.js";

// Utility: shuffle array (Fisher-Yates)
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Utility: nearest lower power of 2
const nextPowerOfTwo = (n) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

// Add this utility function to your match routes or utils file

async function progressKnockoutWinner(match) {
  try {
    if (!match.winner) {
      console.log("⚠️ No winner to propagate");
      return;
    }

    if (!match.nextMatchId) {
      console.log("✅ This is the final match, no propagation needed");
      return;
    }

    const nextMatch = await Match.findById(match.nextMatchId);
    if (!nextMatch) {
      console.error("❌ Next match not found:", match.nextMatchId);
      return;
    }

    console.log(`🔄 Propagating winner from match ${match._id} to ${nextMatch._id}`);
    console.log(`   Winner: ${match.winner}, Slot: ${match.nextSlot}`);

    // Update the appropriate slot in the next match
    if (match.nextSlot === 'teamA') {
      nextMatch.teamA = {
        teamId: match.winner,
        autoAdvanced: true
      };
    } else if (match.nextSlot === 'teamB') {
      nextMatch.teamB = {
        teamId: match.winner,
        autoAdvanced: true
      };
    }

    await nextMatch.save();

    console.log(`✅ Winner propagated successfully to ${match.nextSlot}`);

    // Check if both teams are now filled and both auto-advanced (double bye scenario)
    if (
      nextMatch.teamA?.teamId && 
      nextMatch.teamB?.teamId && 
      nextMatch.teamA.autoAdvanced && 
      nextMatch.teamB.autoAdvanced &&
      nextMatch.status === 'upcoming'
    ) {
      console.log("⚠️ Both teams in next match are auto-advanced. Consider auto-scheduling.");
      // You might want to auto-start this match or notify admins
    }

    return nextMatch;

  } catch (err) {
    console.error("❌ Error in progressKnockoutWinner:", err);
    throw err;
  }
}

// Export or add to your module
export { progressKnockoutWinner };






const router=express.Router();
const checkEvent = async (eventId) => {
  return await Event.findById(eventId);
};

router.post("/new",authenticate,async(req,res)=>{
const userid=req.user.id;
const {clubid,name,description,maxPlayer,status,teamc}=req.body;
try {
    const check=await Club.findById(clubid);//club exist karta hai ya nahi
if(!check){
    return res.status(404).json({message:"No club found!"});
}
if (check.admin.toString()===userid || check.managers.map(id=>id.toString()).includes(userid)){
    const event=new Event({name,admin:[userid],club:clubid,description,maxPlayer,status,teamsBy:teamc});
    const newevent=await event.save();
    check.events.push(newevent._id);
    const user=await User.findById(userid);
    user.events.push(newevent._id);
    await user.save();
    await check.save();
    return res.status(200).json({message:"event created",eventId: newevent._id});
}
else{
    return res.status(401).json({message:"Unauthorized"});
}
} catch (error) {
     console.error(error);
    return res.status(500).json({ error: "Server error occurred!" });
}

});
// router.post("/promote", authenticate, checkadmin, async (req, res) => {
//   try {
//     console.log("/promote route hit");
//     const { userid, post, eventid } = req.body;

//     if (!userid || !post)
//       return res.status(400).json({ message: "Missing data" });

//     let user;

//     // If userid is a valid ObjectId → search by _id
//     if (mongoose.Types.ObjectId.isValid(userid)) {
//       user = await User.findById(userid);
//     } 
//     else {
//       // Otherwise, treat it as username OR email
//       user = await User.findOne({
//         $or: [{ email: userid }, { username: userid }]
//       });
//     }

//     if (!user)
//       return res.status(404).json({ message: "User does not exist" });

//     // Update role
//     user.role = post;
//     await user.save();

//     return res.json({ message: "User promoted successfully", user });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// });
router.post("/promote",authenticate,checkmanager,async(req,res)=>{
const adminid=req.user.id;
const {userid,eventid,post}=req.body;
try {
    const check=await User.findById(userid);
  if(!check) return res.status(404).json({message:"No user found!"})

const event=await Event.findById(eventid);

  if (!event) return res.status(404).json({ message: "Event not found" });
  const clubid=event.club;
  const club=await Club.findById(clubid);
 if (!check.clubs.map(id => id.toString()).includes(clubid.toString())){
  check.clubs.push(clubid);
  await check.save();

 }
   
  
  if (!event.admin.map(id => id.toString()).includes(adminid))
      return res.status(401).json({ message: "Unauthorized" });
if(post==="admin"){
    if(event.admin.length>=2) return res.status(400).json({message:"Can't make more than 2 admins"});
    if (!event.admin.map(id => id.toString()).includes(userid)) {
    event.admin.push(userid);
    check.events.push(eventid);
    await event.save();
    await check.save();
    return res.status(200).json({message:"new admin created"});
}

     
}
else{
   if (!event.managers.map(id => id.toString()).includes(userid)) {
    event.managers.push(userid);
    check.events.push(eventid);
    await check.save();
    await event.save();
   return res.status(200).json({message:"new manager created"});
}
else{
      return res.status(401).json({ message: "User is already a manager" });
}
     
    
}
} catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error occurred!" });
}

});

router.post("/updates",authenticate,checkmanager,async(req,res)=>{
try {
    const userid=req.user.id;
    const {eventid,message}=req.body;
    const event=await Event.findById(eventid);
    if (!event) return res.status(404).json({ message: "Event not found" });
    event.updates.push({
        message,
        createdBy:userid,
        })
        await event.save();
        return res.status(200).json({message:"Message emitted sucessfully"});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/new-schedule",authenticate,async(req,res)=>{
    try {
const {eventid,title,date,time,location,description}=req.body;
if(!eventid || !title || !date || !time || !location ) return res.status(400).json({ message: "Missing fields" });
const event=await Event.findById(eventid);
 if (!event) return res.status(404).json({ message: "Event not found" });
 const sched=await schedule.create({
  eventid,title,date,time,location,description
 });
await sched.save();
event.schedules.push(sched._id);
await event.save();
return res.status(200).json({
    message:`New schedule for ${event.name} created `
});
    } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
    }


});

router.post("/join-event",authenticate,async(req,res)=>{
  try {
    const playerid=req.user.id;
    const {scheduleid,eventid}=req.body;
    const user=await User.findById(playerid);
const event=await Event.findById(eventid);
 if (!event)
      return res.status(404).json({ message: "Event not found" });

  if (event.users.map(id => id.toString()).includes(playerid)) return res.status(400).json({message:"player already in event"});
event.users.push(playerid);
await event.save();
user.events.push(eventid);
await user.save();
return res.status(200).json({message:"player added"});

  } catch (error) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }

});


router.post(
 "/match/create",
 authenticate,
 checkmanager,
 async(req,res)=>{
  try{

    const {
      eventid,
      scheduleid,
      stageid,
      teamA,
      teamB,
      slotIndex,
      matchType
    } = req.body;

    const event = await Event.findById(eventid);

    if(!event){
      return res.status(404).json({
        message:"Event not found"
      });
    }

    const stage = await Stage.findById(stageid);

    if(!stage){
      return res.status(404).json({
        message:"Stage not found"
      });
    }

    const match = await Match.create({
      eventid,
      scheduleid,
      stageid,

      slotIndex,

      matchType,

      teamA:{
        teamId:teamA
      },

      teamB:{
        teamId:teamB
      }
    });

    stage.matches.push(match._id);

    await stage.save();

    return res.status(201).json({
      message:"Match created",
      match
    });

  }catch(err){
    console.error(err);

    return res.status(500).json({
      message:"Server error"
    });
  }
});



//get routes-
router.get("/club/:clubId", authenticate, async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await Club.findById(clubId).populate("events");

    if (!club) return res.status(404).json({ message: "Club not found" });

    return res.status(200).json({
      club: club.name,
      events: club.events
    });
  } catch (error) {
    console.error("GET /events/club/:clubId", error);
    return res.status(500).json({ message: "Server error" });
  }
});
// GET: events user created or joined
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const events = await Event.find({
      $or: [
        { admin: userId },
        { managers: userId },
        { players: userId }
      ]
    });

    return res.status(200).json({ events });
  } catch (error) {
    console.error("GET /events", error);
    return res.status(500).json({ message: "Server error" });
  }
});
router.get("/:eventId/teams", authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate("teams");

    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.status(200).json({ teams: event.teams });
  } catch (error) {
    console.error("GET /events/:eventId/teams", error);
    return res.status(500).json({ message: "Server error" });
  }
});
router.get("/:eventId/schedules", authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) return res.status(404).json({ message: "Event not found" });

    const schedules=await Schedule.find({eventid:eventId});
    return res.status(200).json(schedules);
  } catch (error) {
    console.error("GET /events/:eventId/schedules", error);
    return res.status(500).json({ message: "Server error" });
  }
});
 router.get("/club/:clubId", authenticate, async (req, res) => {
  try {
    const { clubId } = req.params;

    const club = await Club.findById(clubId).populate("events");

    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    return res.status(200).json({
      club: club.name,
      events: club.events
    });
  } catch (error) {
    console.error("GET /events/club/:clubId error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});



router.get("/roles/:eventid", authenticate, async (req, res) => {
  try {
    const eventid = req.params.eventid;

    const event = await Event.findById(eventid).populate("admin managers", "username email name");
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.json({
      admins: event.admin || [],
      managers: event.managers || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/:eventId", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const event = await Event.findById(req.params.eventId)
      .populate("teams")

    if (!event) return res.status(404).json({ message: "Event not found" });

    // Check roles
    let isAdmin = event.admin?.map(id => id.toString()).includes(userId);

let isManager = event.managers?.map(id => id.toString()).includes(userId);


    res.json({
      event,
      role: isAdmin ? "admin" : isManager ? "manager" : "participant",
      
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// -------------------
// PRIVATE QUERY ROUTES (GET + POST)
// -------------------



// GET: fetch queries for an event
router.get("/:eventId/queries", authenticate, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user?.id || req.user?._id;

    console.log("[routes:event] GET /:eventId/queries user:", userId);

    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const uid = String(userId);

    const isEventAdmin = Array.isArray(event.admin)
      ? event.admin.map(String).includes(uid)
      : event.admin?.toString() === uid;

    const isManager = Array.isArray(event.managers)
      ? event.managers.map(String).includes(uid)
      : false;

    let query = { eventId };

    if (!(isEventAdmin || isManager)) {
      // participant view → private only
      query = {
        eventId,
        $or: [{ sender: uid }, { targetUser: uid }],
        visibility: "private",
      };
    }

    const items = await QueryMessage.find(query)
      .sort({ createdAt: 1 })
      .populate("sender", "username name")
      .lean();

    return res.json({ success: true, data: items });
  } catch (err) {
    console.error("[routes:event] GET queries error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST: create query (fallback when socket unavailable)
router.post("/:eventId/queries", authenticate, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const message = (req.body?.message || "").trim();
    const userId = req.user?.id || req.user?._id;

    console.log("[routes:event] POST /:eventId/queries body:", req.body);

    if (!message) return res.status(400).json({ success: false, error: "Message required" });

    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ success: false, error: "Event not found" });

    const uid = String(userId);

    const isEventAdmin = Array.isArray(event.admin)
      ? event.admin.map(String).includes(uid)
      : event.admin?.toString() === uid;

    const isManager = Array.isArray(event.managers)
      ? event.managers.map(String).includes(uid)
      : false;

    let isParticipant = true;
    if (Array.isArray(event.participants)) {
      isParticipant = event.participants.map(String).includes(uid);
    }

    if (!isParticipant && !isEventAdmin && !isManager) {
      console.warn("[routes:event] unauthorized POST query", uid);
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const senderRole = isEventAdmin || isManager ? "event-admin" : "participant";
    const visibility = "private";
    const targetUser = senderRole === "participant" ? uid : req.body.targetUser || null;

    const q = await QueryMessage.create({
      eventId,
      sender: uid,
      senderRole,
      message,
      visibility,
      targetUser,
      replyTo: req.body.replyToId || null,
    });

    const populated = await QueryMessage.findById(q._id)
      .populate("sender", "username name")
      .lean();

    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error("[routes:event] POST queries error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});


// ---------------------------------------------------
// STEP 1: GENERATE SCHEDULE (SKELETON)
// ---------------------------------------------------
router.post("/:eventId/schedule", authenticate, async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.id;

  try {
    console.log("\n🎯 ========== SCHEDULE GENERATION STARTED ==========");
    console.log("📋 Event ID:", eventId);
    console.log("👤 User ID:", userId);

    const event = await Event.findById(eventId);
    if (!event) {
      console.log("❌ Event not found");
      return res.status(404).json({ message: "Event not found" });
    }

    const isAdmin =
      event.admin.some(id => id.toString() === userId) ||
      event.managers.some(id => id.toString() === userId);

    if (!isAdmin) {
      console.log("❌ User not authorized");
      return res.status(403).json({ message: "Not authorized" });
    }

    if (await Stage.exists({ eventid: eventId })) {
      console.log("⚠️ Schedule already exists");
      return res.status(400).json({ message: "Schedule already exists" });
    }

    const teams = await Team.find({ eventid: eventId });
    console.log(`✅ Found ${teams.length} teams`);
    
    if (teams.length < 2) {
      console.log("❌ Not enough teams");
      return res.status(400).json({ message: "At least 2 teams required" });
    }

    // ---------------- HELPERS ----------------
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

    const nextPowerOfTwo = n => {
      let p = 1;
      while (p < n) p *= 2;
      return p;
    };

    const roundName = n => {
      if (n === 2) return "Final";
      if (n === 4) return "Semi Final";
      if (n === 8) return "Quarter Final";
      return `Round of ${n}`;
    };

    // ---------------- SETUP ----------------
    const shuffled = shuffle(teams);
    const totalTeams = shuffled.length;
    const bracketSize = nextPowerOfTwo(totalTeams);
    
    // Calculate how many teams advance to round 2
    const round2Size = bracketSize / 2;
    
    // Teams that need to play in round 1
    const teamsPlayingRound1 = (totalTeams - round2Size) * 2;
    
    // Number of actual matches in round 1
    const firstRoundMatchCount = teamsPlayingRound1 / 2;
    
    // Remaining teams get byes
    const byeCount = totalTeams - teamsPlayingRound1;

    console.log("\n📊 BRACKET CONFIGURATION:");
    console.log("   Total Teams:", totalTeams);
    console.log("   Bracket Size:", bracketSize);
    console.log("   Round 2 Size:", round2Size);
    console.log("   Teams Playing Round 1:", teamsPlayingRound1);
    console.log("   First Round Matches:", firstRoundMatchCount);
    console.log("   Bye Count:", byeCount);

    // ---------------- CREATE ALL STAGES ----------------
    console.log("\n🏆 CREATING STAGES...");
    let stages = [];
    let order = 1;
    let size = bracketSize;

    while (size >= 2) {
      const stage = await Stage.create({
        eventid: eventId,
        name: roundName(size),
        type: "KNOCKOUT",
        order
      });
      console.log(`   ✓ Stage ${order}: ${roundName(size)} (${size} teams)`);
      stages.push(stage);
      size /= 2;
      order++;
    }

    // ---------------- DISTRIBUTE TEAMS WITH BYES ----------------
    console.log("\n🎲 DISTRIBUTING TEAMS...");
    
    const round1Slots = [];
    
    // First, create all the actual match slots
    let teamIndex = 0;
    for (let i = 0; i < firstRoundMatchCount; i++) {
      const teamA = shuffled[teamIndex];
      const teamB = shuffled[teamIndex + 1];
      
      console.log(`   Match Slot ${i}: ${teamA?.teamname || 'UNDEFINED'} vs ${teamB?.teamname || 'UNDEFINED'}`);
      
      if (!teamA || !teamB) {
        console.error(`❌❌❌ CRITICAL: Missing team for match at slot ${i}`);
        console.error(`   TeamA index: ${teamIndex}, TeamB index: ${teamIndex + 1}`);
        console.error(`   Total teams: ${shuffled.length}`);
        throw new Error(`Missing team for match at slot ${i}`);
      }
      
      round1Slots.push({
        type: 'MATCH',
        teamA: teamA,
        teamB: teamB
      });
      teamIndex += 2;
    }
    
    // Then, create bye slots for remaining teams
    while (teamIndex < totalTeams) {
      const team = shuffled[teamIndex];
      console.log(`   Bye Slot ${round1Slots.length}: ${team?.teamname || 'UNDEFINED'} (ID: ${team?._id || 'NONE'})`);
      
      if (!team) {
        console.error(`❌❌❌ CRITICAL: No team available for bye at index ${teamIndex}`);
        throw new Error(`No team available for bye at index ${teamIndex}`);
      }
      
      round1Slots.push({ 
        type: 'BYE', 
        team: team
      });
      teamIndex++;
    }

    console.log(`\n✅ Slot distribution complete. Used ${teamIndex} teams.`);
    console.log(`   Matches: ${firstRoundMatchCount}, Byes: ${byeCount}`);
    
    if (teamIndex !== totalTeams) {
      console.error(`❌❌❌ CRITICAL: Team count mismatch!`);
      console.error(`   Expected: ${totalTeams}, Used: ${teamIndex}`);
      throw new Error(`Team distribution error: expected ${totalTeams}, used ${teamIndex}`);
    }

    // ---------------- CREATE ROUND 1 MATCHES ----------------
    console.log("\n⚔️ CREATING ROUND 1 MATCHES...");
    const round1 = stages[0];
    const round1Matches = [];

    for (let i = 0; i < round1Slots.length; i++) {
      const slot = round1Slots[i];
      
      if (slot.type === 'MATCH') {
        console.log(`   Creating Match ${i + 1}: ${slot.teamA.teamname} vs ${slot.teamB.teamname}`);
        
        const match = await Match.create({
          eventid: eventId,
          stageid: round1._id,
          matchType: "KNOCKOUT",
          slotIndex: i,
          teamA: { teamId: slot.teamA._id, autoAdvanced: false },
          teamB: { teamId: slot.teamB._id, autoAdvanced: false }
        });
        
        console.log(`      ✓ Match created: ${match._id}`);
        round1Matches.push(match);
        
      } else {
        // BYE
        console.log(`   Creating BYE ${i + 1}: ${slot.team.teamname} auto-advances`);
        
        const match = await Match.create({
          eventid: eventId,
          stageid: round1._id,
          matchType: "KNOCKOUT",
          slotIndex: i,
          teamA: { teamId: slot.team._id, autoAdvanced: true },
          teamB: { teamId: null, autoAdvanced: false },
          status: 'finished',
          winner: slot.team._id
        });
        
        console.log(`      ✓ BYE Match created: ${match._id}, Winner: ${slot.team._id}`);
        round1Matches.push(match);
      }
    }

    round1.matches = round1Matches.map(m => m._id);
    await round1.save();
    console.log(`✅ Round 1 complete: ${round1Matches.length} matches created`);

    // ---------------- BUILD SUBSEQUENT ROUNDS ----------------
    console.log("\n🔗 BUILDING SUBSEQUENT ROUNDS...");
    
    for (let i = 1; i < stages.length; i++) {
      const stage = stages[i];
      const prevStage = stages[i - 1];
      
      console.log(`\n   Building ${stage.name} (Stage ${i + 1})...`);
      
      const prevMatches = await Match.find({ stageid: prevStage._id }).sort({ slotIndex: 1 });
      console.log(`      Previous stage has ${prevMatches.length} matches`);
      
      const matches = [];
      
      // Each pair of previous matches feeds into one next match
      for (let j = 0; j < prevMatches.length; j += 2) {
        const matchA = prevMatches[j];
        const matchB = prevMatches[j + 1];
        
        console.log(`      Creating match from pair ${Math.floor(j / 2) + 1}:`);
        console.log(`         Input A: Match ${matchA._id} (${matchA.winner ? 'has winner' : 'no winner'})`);
        console.log(`         Input B: Match ${matchB?._id || 'NONE'} (${matchB?.winner ? 'has winner' : 'no winner'})`);
        
        const newMatch = await Match.create({
          eventid: eventId,
          stageid: stage._id,
          matchType: "KNOCKOUT",
          slotIndex: matches.length,
          teamA: { teamId: null, autoAdvanced: false },
          teamB: { teamId: null, autoAdvanced: false }
        });
        
        console.log(`         ✓ New match created: ${newMatch._id}`);
        
        // Link matchA to teamA slot
        if (matchA) {
          matchA.nextMatchId = newMatch._id;
          matchA.nextSlot = 'teamA';
          await matchA.save();
          console.log(`         ✓ Linked Match ${matchA._id} → teamA`);
          
          // If matchA already has winner (bye), propagate now
          if (matchA.winner) {
            newMatch.teamA = { teamId: matchA.winner, autoAdvanced: true };
            console.log(`         ✓ Propagated winner to teamA: ${matchA.winner}`);
          }
        }
        
        // Link matchB to teamB slot
        if (matchB) {
          matchB.nextMatchId = newMatch._id;
          matchB.nextSlot = 'teamB';
          await matchB.save();
          console.log(`         ✓ Linked Match ${matchB._id} → teamB`);
          
          // If matchB already has winner (bye), propagate now
          if (matchB.winner) {
            newMatch.teamB = { teamId: matchB.winner, autoAdvanced: true };
            console.log(`         ✓ Propagated winner to teamB: ${matchB.winner}`);
          }
        }
        
        await newMatch.save();
        matches.push(newMatch);
      }
      
      stage.matches = matches.map(m => m._id);
      await stage.save();
      console.log(`   ✅ ${stage.name} complete: ${matches.length} matches created`);
    }

    console.log("\n✅ ========== SCHEDULE GENERATION COMPLETE ==========\n");

    return res.status(201).json({
      message: "Schedule created successfully",
      totalTeams,
      bracketSize,
      byeCount,
      firstRoundMatches: firstRoundMatchCount,
      teamsPlayingRound1: firstRoundMatchCount * 2,
      stages: stages.length
    });

  } catch (err) {
    console.error("\n❌❌❌ SCHEDULE ERROR:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).json({ 
      message: "Server error",
      error: err.message 
    });
  }
});





router.put("/:eventId/lock-schedule", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { eventId } = req.params;

  console.log("=====================================");
  console.log("[LOCK] Schedule lock request");
  console.log("[LOCK] User:", userId);
  console.log("[LOCK] Event:", eventId);
  console.log("=====================================");

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // 🔒 Admin only
    const isAdmin = event.admin.some(id => id.toString() === userId);
    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admin can lock schedule"
      });
    }

    // 🔍 Schedule must exist
    const stages = await Stage.find({ eventid: eventId }).populate("matches");
    if (stages.length === 0) {
      return res.status(400).json({
        message: "Cannot lock schedule before generation"
      });
    }

    // 🔍 Ensure all matches have teams assigned
    for (const stage of stages) {
      for (const matchId of stage.matches) {
        const match = await Match.findById(matchId);
        if (!match?.teamA?.teamId || !match?.teamB?.teamId) {
          return res.status(400).json({
            message: "All matches must have teams before locking schedule"
          });
        }
      }
    }

    // 🔁 Already locked
    if (event.isScheduleLocked) {
      return res.status(400).json({
        message: "Schedule is already locked"
      });
    }

    // 🔐 Atomic lock
    event.isScheduleLocked = true;
    await event.save();

    console.log("[LOCK] Schedule locked successfully");

    return res.status(200).json({
      message: "Schedule locked successfully",
      eventId
    });

  } catch (error) {
    console.error("[LOCK][ERROR]", error);
    return res.status(500).json({
      message: "Server error while locking schedule"
    });
  }
});
router.put("/matches/:matchId/teams", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { matchId } = req.params;
  const { teamA, teamB } = req.body;

  try {
    if (!teamA || !teamB || teamA === teamB) {
      return res.status(400).json({ message: "Invalid teams" });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (match.status !== "upcoming") {
      return res.status(400).json({ message: "Match already started" });
    }

    const event = await Event.findById(match.eventid);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.isScheduleLocked) {
      return res.status(403).json({ message: "Schedule locked" });
    }

    const isAdmin = event.admin.some(id => id.toString() === userId);
    const isManager = event.managers.some(id => id.toString() === userId);
    if (!isAdmin && !isManager) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const teamADoc = await Team.findById(teamA);
    const teamBDoc = await Team.findById(teamB);

    if (
      !teamADoc ||
      !teamBDoc ||
      teamADoc.eventid.toString() !== event._id.toString() ||
      teamBDoc.eventid.toString() !== event._id.toString()
    ) {
      return res.status(400).json({ message: "Teams invalid for event" });
    }

    match.teamA.teamId = teamA;
    match.teamB.teamId = teamB;
    await match.save();

    return res.json({ message: "Match teams updated" });

  } catch (err) {
    console.error("[EDIT MATCH TEAMS ERROR]", err);
    return res.status(500).json({ message: "Server error" });
  }
});




router.put("/:matchId/status", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { matchId } = req.params;
  const { status } = req.body;

  console.log("=====================================");
  console.log("[MATCH STATUS] Update request");
  console.log("[MATCH STATUS] User:", userId);
  console.log("[MATCH STATUS] Match:", matchId);
  console.log("[MATCH STATUS] New Status:", status);
  console.log("=====================================");

  try {
    // ✅ Only allow LIVE
    if (status !== "live") {
      return res.status(400).json({
        message: "Only 'live' status is allowed here"
      });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const event = await Event.findById(match.eventid);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // 🔒 Schedule must be locked
    if (!event.isScheduleLocked) {
      return res.status(403).json({
        message: "Lock schedule before starting matches"
      });
    }

    const isAdmin = event.admin.some(id => id.toString() === userId);
    const isManager = event.managers.some(id => id.toString() === userId);
    if (!isAdmin && !isManager) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (match.status !== "upcoming") {
      return res.status(400).json({
        message: "Match already started or finished"
      });
    }

    match.status = "live";
    await match.save();

    console.log("[MATCH STATUS] Match is live");

    return res.json({
      message: "Match started",
      matchId
    });

  } catch (error) {
    console.error("[MATCH STATUS][ERROR]", error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

router.put("/:matchId/result", authenticate, async (req, res) => {
  const userId = req.user.id;
  const { matchId } = req.params;
  const { winnerTeamId } = req.body;

  try {
    if (!winnerTeamId) {
      return res.status(400).json({
        message: "Winner team is required"
      });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const event = await Event.findById(match.eventid);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // 🔒 ADMIN ONLY
    const isAdmin = event.admin.some(id => id.toString() === userId);
    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admin can override results"
      });
    }

    if (match.winner) {
      return res.status(400).json({
        message: "Winner already declared"
      });
    }

    const teamA = match.teamA.teamId?.toString();
    const teamB = match.teamB.teamId?.toString();

    if (![teamA, teamB].includes(winnerTeamId)) {
      return res.status(400).json({
        message: "Winner must be one of match teams"
      });
    }

    match.winner = winnerTeamId;
    match.status = "finished";
    await match.save();

    await progressKnockoutWinner(match);

    return res.json({
      message: "Winner overridden and progressed",
      winnerTeamId
    });

  } catch (err) {
    console.error("[RESULT ERROR]", err);
    return res.status(500).json({ message: "Server error" });
  }
});





/**
 * GET all stages with matches for an event
 */
router.get("/:eventId", authenticate, async (req, res) => {
  const { eventId } = req.params;

  console.log("=====================================");
  console.log("[STAGES] Fetch stages for event");
  console.log("[STAGES] Event:", eventId);
  console.log("=====================================");

  try {
    const stages = await Stage.find({ eventid: eventId })
      .sort({ order: 1 })
      .populate({
        path: "matches",
        populate: [
          {
            path: "teamA.teamId",
            select: "teamname"
          },
          {
            path: "teamB.teamId",
            select: "teamname"
          }
        ]
      });

    console.log("[STAGES] Stages found:", stages.length);

    return res.status(200).json(stages);
  } catch (error) {
    console.error("[STAGES][ERROR]", error);
    return res.status(500).json({
      message: "Failed to fetch stages"
    });
  }
});

// ---------------------------------------------------
// GET STAGES + MATCHES FOR EVENT (READ API)
// ---------------------------------------------------
router.get("/:eventId/stages", authenticate, async (req, res) => {
  const { eventId } = req.params;

  try {
    const stages = await Stage.find({ eventid: eventId })
      .sort({ order: 1 })
      .populate({
        path: "matches",
        options: { sort: { slotIndex: 1 } }, // 🔥 CRITICAL FIX
        populate: [
          {
            path: "teamA.teamId",
            model: "Team",
            select: "teamname"
          },
          {
            path: "teamB.teamId",
            model: "Team",
            select: "teamname"
          }
        ]
      });

    return res.status(200).json(stages);
  } catch (error) {
    console.error("[STAGES][ERROR]", error);
    return res.status(500).json({
      message: "Failed to fetch stages"
    });
  }
});


// GET SINGLE MATCH
router.get("/matches/:matchId", authenticate, async (req,res)=>{
  const { matchId } = req.params;

  console.log("[MATCH READ] Fetch match:", matchId);

  try {
    const match = await Match.findById(matchId)
      .populate("teamA.teamId","teamname")
      .populate("teamB.teamId","teamname");

    if(!match){
      return res.status(404).json({message:"Match not found"});
    }

    return res.json(match);
  } catch(err){
    console.error("[MATCH READ ERROR]",err);
    return res.status(500).json({message:"Server error"});
  }
});

// GET FINAL WINNER
router.get("/:eventId/winner", authenticate, async (req, res) => {
  const { eventId } = req.params;

  try {
    const finalStage = await Stage.findOne({
      eventid: eventId,
      name: "Final"
    }).populate({
      path: "matches",
      populate: {
        path: "winner",
        select: "teamname"
      }
    });

    if (
      !finalStage ||
      !finalStage.matches ||
      finalStage.matches.length === 0
    ) {
      return res.json({ winner: null });
    }

    const finalMatch = finalStage.matches[0];

    if (!finalMatch?.winner) {
      return res.json({ winner: null });
    }

    return res.json({
      winner: finalMatch.winner
    });

  } catch (err) {
    console.error("[WINNER FETCH ERROR]", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.put("/matches/:matchId/round/score",
  authenticate,
  async (req, res) => {
    const { matchId } = req.params;
    const { team, points } = req.body;

    console.log("=====================================");
    console.log("[ROUND SCORE]");
    console.log({ matchId, team, points });
    console.log("=====================================");

    try {
      if (!["A", "B"].includes(team)) {
        return res.status(400).json({ message: "Invalid team" });
      }

      if (typeof points !== "number" || points < 0) {
        return res.status(400).json({ message: "Invalid score value" });
      }

      const match = await Match.findById(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      if (match.status !== "live") {
        return res.status(400).json({ message: "Match is not live" });
      }

      let round = match.rounds.find(r => !r.isCompleted);

      if (!round) {
        const nextRoundNo =
          match.rounds.length === 0
            ? 1
            : Math.max(...match.rounds.map(r => r.roundNo)) + 1;

        round = match.rounds.create({
          roundNo: nextRoundNo,
          teamA_score: 0,
          teamB_score: 0,
          isCompleted: false
        });

        match.rounds.push(round);

        console.log("[ROUND SCORE] New round created:", nextRoundNo);
      }

      if (team === "A") round.teamA_score = points;
      if (team === "B") round.teamB_score = points;

      await match.save();

      emitMatchEvent(
        req.io,
        match.eventid.toString(),
        "match:round:update",
        {
          matchId: match._id.toString(),
          roundNo: round.roundNo,
          teamA_score: round.teamA_score,
          teamB_score: round.teamB_score
        }
      );

      return res.json({
        message: "Score updated",
        roundNo: round.roundNo,
        teamA_score: round.teamA_score,
        teamB_score: round.teamB_score
      });

    } catch (err) {
      console.error("[ROUND SCORE ERROR]", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);





router.post("/matches/:matchId/round/end",
  authenticate,
  async (req, res) => {
    const { matchId } = req.params;
    const userId = req.user.id.toString();

    console.log("=====================================");
    console.log("[ROUND END]");
    console.log({ matchId, userId });
    console.log("=====================================");

    try {
      const match = await Match.findById(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      if (match.status !== "live") {
        return res.status(400).json({ message: "Match is not live" });
      }

      const event = await Event.findById(match.eventid);
      const isAuthorized =
        event.admin.some(id => id.toString() === userId) ||
        event.managers.some(id => id.toString() === userId);

      if (!isAuthorized) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const round = match.rounds.find(r => !r.isCompleted);
      if (!round) {
        return res.status(400).json({ message: "No active round" });
      }

      if (round.teamA_score > round.teamB_score) {
        round.winner = match.teamA.teamId;
      } else if (round.teamB_score > round.teamA_score) {
        round.winner = match.teamB.teamId;
      } else {
        round.winner = null;
      }

      round.isCompleted = true;
      await match.save();

      emitMatchEvent(
        req.io,
        match.eventid.toString(),
        "match:round:ended",
        {
          matchId: match._id.toString(),
          roundNo: round.roundNo,
          winner: round.winner
        }
      );

      return res.json({
        message: "Round ended",
        roundNo: round.roundNo,
        winner: round.winner
      });

    } catch (err) {
      console.error("[ROUND END ERROR]", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);






router.put("/matches/:matchId/status",
  authenticate,
  async (req, res) => {
    const { matchId } = req.params;
    const { status } = req.body;

    if (status !== "live") {
      return res.status(400).json({ message: "Invalid status" });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status !== "upcoming") {
      return res.status(400).json({
        message: "Only upcoming matches can be started"
      });
    }

    const event = await Event.findById(match.eventid);
    const isAuthorized =
      event.admin.some(id => id.toString() === req.user.id) ||
      event.managers.some(id => id.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({ message: "Not authorized" });
    }

    match.status = "live";
    await match.save();

    emitMatchEvent(
      req.io,
      match.eventid.toString(),
      "match:started",
      { matchId }
    );

    return res.json({ message: "Match started" });
  }
);


router.post("/matches/:matchId/start",
  authenticate,
  async (req, res) => {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status !== "upcoming") {
      return res.status(400).json({ message: "Match already started" });
    }

    match.status = "live";

    // 🔥 CREATE FIRST ROUND
    match.rounds.push({
      roundNo: 1,
      teamA_score: 0,
      teamB_score: 0,
      isCompleted: false
    });

    match.currentRound = 1;

    await match.save();

    res.json({ message: "Match started" });
  }
);
router.post("/matches/:matchId/end", authenticate, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id.toString();

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    if (match.status === "finished") {
      return res.status(400).json({ message: "Match already ended" });
    }

    const event = await Event.findById(match.eventid);
    const isAuthorized =
      event.admin.some(id => id.toString() === userId) ||
      event.managers.some(id => id.toString() === userId);

    if (!isAuthorized) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const activeRound = match.rounds.find(r => !r.isCompleted);
    if (activeRound) {
      return res.status(400).json({
        message: "End the current round before ending match"
      });
    }

    // Count wins
    const wins = {};
    for (const r of match.rounds) {
      if (r.isCompleted && r.winner) {
        wins[r.winner.toString()] =
          (wins[r.winner.toString()] || 0) + 1;
      }
    }

    const winnerId = Object.keys(wins).sort(
      (a, b) => wins[b] - wins[a]
    )[0];

    if (!winnerId) {
      return res.status(400).json({ message: "Winner could not be decided" });
    }

    match.winner = winnerId;
    match.status = "finished";
    await match.save();

    // ✅ FIXED: propagate winner safely
    if (match.matchType === "KNOCKOUT") {
  console.log("🔥 Triggering propagation for match:", match._id);
  await progressKnockoutWinner(match);
}


    emitMatchEvent(req.io, match.eventid.toString(), "match:ended", {
      matchId: match._id.toString(),
      winner: winnerId
    });

    return res.json({
      message: "Match ended successfully",
      winner: winnerId
    });

  } catch (err) {
    console.error("[MATCH END ERROR]", err);
    return res.status(500).json({ message: "Server error" });
  }
});







export default router;