import mongoose from "mongoose";

const eventSchema=new mongoose.Schema({
      name:{type:String,required:true},
      description:{type:String},
  admin:[{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}],
  managers:[{type:mongoose.Schema.Types.ObjectId,ref:"User",default:[]}],
schedules:[{type:mongoose.Schema.Types.ObjectId,ref:"Schedule"}],
users:[{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}],
  club:{type:mongoose.Schema.Types.ObjectId,ref:"Club",required:true},
teamsBy:{type:String,default:"users"},
imgURL:{type:String},
Sport:{type:String},
genderres:{type:String},
maxmale:{type:Number},
maxfemale:{type:Number},
  rules:[{
title:{type:String},
points:[{type:String}],
  }],

  status:{type:String},
    updates: [
        {
            message: String,
            createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            createdAt: { type: Date, default: Date.now }
        }
    ],
     minPlayer:{type:Number,default:1}, 
    maxPlayer:{type:Number,required:true},

     teams:[{type:mongoose.Schema.Types.ObjectId,ref:"Team",
    }],
        qualifiedPlayers: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            round: String,   // "prequalifier", "qualifier", "semi-final", etc.
            qualifiedAt: Date
        }
    ],
    
    // Player bidding system
    auction: {
        enabled: { type: Boolean, default: false },
        basePrice: Number,
        bids: [
            {
                player: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                bidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                amount: Number,
                time: Date
            }
        ]
    },

    // Private chats between user & admins/managers
    queries: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            messages: [
                {
                    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                    text: String,
                    time: Date
                }
            ]
        }
    ],
    isScheduleLocked: { type: Boolean, default: false }

},{timestamps:true});

const eventModel=mongoose.model("Event",eventSchema);
export default eventModel;
