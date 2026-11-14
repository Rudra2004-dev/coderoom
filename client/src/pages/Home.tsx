import { getUser } from "../api";
import Navbar from "../components/Navbar";
import InterviewerHome from "../components/InterviewerHome";
import CandidateHome from "../components/CandidateHome";

export default function Home() {
  const user = getUser();

  if (user?.role === "interviewer") {
    return (
      <div className="lt-bg">
        <Navbar variant="light" />
        <InterviewerHome />
      </div>
    );
  }

  // Candidate: light theme, locked to one screen (scrolls only on phones and very short windows)
  return (
    <div className="lt-bg landing-root relative flex flex-col">
      <div className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="relative z-10 shrink-0">
        <Navbar variant="light" />
      </div>
      <CandidateHome />
    </div>
  );
}