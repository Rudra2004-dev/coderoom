import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-gray-400">That page doesn't exist.</p>
        <Link to="/" className="underline text-blue-400">Back to home</Link>
      </div>
    </div>
  );
}