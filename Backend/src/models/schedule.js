import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
  title: String,
  date: Date,
  time: String,
  location: String,
  description: String,

  eventid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },

  matches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
    },
  ],
  qualifiedTeams:[
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
  ]
},{ timestamps: true });

export default mongoose.model("Schedule",scheduleSchema);
