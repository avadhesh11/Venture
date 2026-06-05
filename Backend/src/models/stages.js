import mongoose from "mongoose";

const stageSchema = new mongoose.Schema(
  {
    eventid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ["KNOCKOUT", "LEAGUE"],
      required: true
    },

    order: {
      type: Number,
      required: true
    },

    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Team"
      }
    ],

    // 🔥 FIX IS HERE
    matches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Match"
      }
    ],
    scheduleid:{
   type:mongoose.Schema.Types.ObjectId,
   ref:"Schedule",
   required:true
},

    status: {
      type: String,
      enum: ["pending", "ongoing", "completed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

const Stage = mongoose.model("Stage", stageSchema);
export default Stage;
