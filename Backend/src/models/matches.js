import mongoose from "mongoose";

const matchSchema = new mongoose.Schema({
  eventid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  scheduleid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Schedule",
    required: true,
  },

  slotIndex: {
    type: Number,
    required: true,
  },

  matchType: {
    type: String,
    enum: ["KNOCKOUT", "LEAGUE"],
    required: true,
  },

  status: {
    type: String,
    enum: ["upcoming", "live", "finished"],
    default: "upcoming",
  },

  teamA: {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    autoAdvanced: {
      type: Boolean,
      default: false,
    },
  },

  teamB: {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    autoAdvanced: {
      type: Boolean,
      default: false,
    },
  },

  nextMatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Match",
    default: null,
  },

  nextSlot: {
    type: String,
    enum: ["teamA", "teamB"],
    default: null,
  },

  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    default: null,
  },

  isDraw: {
    type: Boolean,
    default: false,
  },

  decidedBy: {
    type: String,
    enum: ["NORMAL", "PENALTY"],
    default: "NORMAL",
  },

  rounds: [
    {
      roundNo: Number,
      teamA_score: { type: Number, default: 0 },
      teamB_score: { type: Number, default: 0 },
      winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team",
      },
      isCompleted: {
        type: Boolean,
        default: false,
      },
    },
  ],

  currentRound: {
    type: Number,
    default: 1,
  },
},
  { timestamps: true }
);

export default mongoose.model("Match", matchSchema);
