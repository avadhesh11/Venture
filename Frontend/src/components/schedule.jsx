import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams ,useNavigate} from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import axiosInstance from "../utils/axiosInstance";
export default function SchedulePage() {
const { clubid, eventId, scheduleid } = useParams();
const scheduleId = scheduleid;


const navigate=useNavigate();
const [teams, setTeams] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [matches, setMatches] = useState([]);
  const [qualifiedTeams, setQualifiedTeams] = useState([]);
  const [role, setRole] = useState("participant");
  const [loading, setLoading] = useState(true);
const [showCreateMatch, setShowCreateMatch] = useState(false);
// console.log(teams);
const [newMatch, setNewMatch] = useState({
  teamA: "",
  teamB: "",
  slotIndex: "",
  matchType: ""
});
  const getAuthConfig = () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;
    return { headers: { Authorization: `Bearer ${token}` } };
  };
const fetchAvailableTeams = async () => {
  try {

    const config = getAuthConfig();

    const res = await axiosInstance.get(
      `/match/available-teams/${scheduleId}`,
      config
    );

    setTeams(res.data.teams);

  } catch (err) {
    console.error(err);
  }
};
  const fetchScheduleInfo = async () => {
    try {
      const config = getAuthConfig();
      const res = await axiosInstance.get(
        `/schedule/${scheduleId}`,
        config
      );

      setSchedule(res.data.schedule);
      setMatches(res.data.matches);
      setQualifiedTeams(res.data.qualified || []);
      setRole(res.data.role);
    } catch (err) {
      console.error("Schedule fetch failed", err);
    } finally {
      setLoading(false);
    }
  };
const fetchMatches = async () => {
  try {
    const config = getAuthConfig();

    const res = await axiosInstance.get(
      `/match/schedule/${scheduleId}`,
      config
    );

    setMatches(res.data.matches);
  } catch (err) {
    console.error(err);
  }
};


const createMatch = async () => {
  try {

    const config = getAuthConfig();

    await axiosInstance.post(
      "/match/create",
      {
        eventid: eventId,
        scheduleid: scheduleId,

        teamA: newMatch.teamA,
        teamB: newMatch.teamB,

        slotIndex: Number(newMatch.slotIndex),

        matchType: schedule.title
      },
      config
    );

    setShowCreateMatch(false);

    fetchMatches();

  } catch (err) {
    console.error(err);
  }
};
  useEffect(() => {
    fetchScheduleInfo();
    fetchMatches();
    fetchAvailableTeams();
  }, [scheduleId]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Loading schedule…
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* HEADING */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <h1 className="text-3xl font-bold">{schedule.title}</h1>
          <p className="text-slate-400 mt-1">{schedule.date} • {schedule.time}</p>
          <p className="text-slate-400">{schedule.location}</p>
          {schedule.description && (
            <p className="mt-2 text-slate-300">{schedule.description}</p>
          )}
        </div>

       <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-semibold">
      Matches
    </h2>

    {role !== "participant" && (
      <button
      onClick={() => setShowCreateMatch(true)}
        className="px-4 py-2 bg-emerald-600 rounded"
      >
        Create Match
      </button>
    )}
  </div>

  {matches.length === 0 ? (
    <p className="text-slate-500">
      No matches scheduled yet
    </p>
  ) : (
    <div className="space-y-3">
      {matches.map((match) => (
        <div
        onClick={
()=>{
  navigate(`/events/${clubid}/${eventId}}/matches/${match._id}`)
}
}
          key={match._id}
          className="bg-slate-700 rounded p-4"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">
                {match.teamA?.teamId?.teamname || "TBD"}
                {" vs "}
                {match.teamB?.teamId?.teamname || "TBD"}
              </p>

              <p className="text-xs text-slate-400">
                Slot #{match.slotIndex}
              </p>

              <p className="text-xs text-slate-400">
                {match.matchType}
              </p>
            </div>

            <span
              className={`px-2 py-1 rounded text-xs ${
                match.status === "upcoming"
                  ? "bg-blue-600"
                  : match.status === "live"
                  ? "bg-green-600"
                  : "bg-yellow-600"
              }`}
            >
              {match.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

        {/* QUALIFIED TEAMS */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <h2 className="text-xl font-semibold">Qualified Teams</h2>

          {qualifiedTeams.length === 0 ? (
            <p className="text-slate-500 text-sm mt-2">No teams qualified yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {qualifiedTeams.map((t) => (
                <div
                  key={t._id}
                  className="p-3 bg-slate-700 rounded border border-slate-600"
                >
                  <p className="font-medium">{t.teamname}</p>
                  <p className="text-xs text-slate-400">
                    Members: {t.members.length}
                  </p>
                </div>
              ))}
            </div>
          )}
          {
showCreateMatch && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">

    <div className="bg-slate-800 p-6 rounded-lg w-96">

      <h2 className="text-xl font-bold mb-4">
        Create Match
      </h2>


      <select
  value={newMatch.teamA}
  onChange={(e) =>
    setNewMatch({
      ...newMatch,
      teamA: e.target.value
    })
  }
  className="w-full p-2 bg-slate-700 rounded"
>
  <option value="">
    Select Team A
  </option>

  {teams.map(team => (
    <option
      key={team._id}
      value={team._id}
    >
      {team.teamname}
    </option>
  ))}
</select>

     <select
  value={newMatch.teamB}
  onChange={(e) =>
    setNewMatch({
      ...newMatch,
      teamB: e.target.value
    })
  }
  className="w-full p-2 bg-slate-700 rounded"
>
  <option value="">
    Select Team B
  </option>

  {teams
    .filter(
      team =>
        team._id !== newMatch.teamA
    )
    .map(team => (
      <option
        key={team._id}
        value={team._id}
      >
        {team.teamname}
      </option>
    ))}
</select>

      <input
        placeholder="Slot Index"
        type="number"
        className="w-full p-2 rounded bg-slate-700 mb-3"
        onChange={(e)=>
          setNewMatch({
            ...newMatch,
            slotIndex:e.target.value
          })
        }
      />

      <button
        onClick={createMatch}
        className="w-full bg-emerald-600 p-2 rounded"
      >
        Create
      </button>
      <button onClick={()=>{setShowCreateMatch(false)}} className="text-xl font-bold mb-4">
        Back
      </button>

    </div>

  </div>
)
}
        </div>

      </div>
    </div>
  );
}
