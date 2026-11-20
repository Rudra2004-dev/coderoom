import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="lt-bg flex items-center justify-center p-6">
      <div className="lt-card max-w-md space-y-4 p-10 text-center">
        <h1 className="text-4xl font-bold text-slate-900">404</h1>
        <p className="text-slate-500">That page doesn't exist.</p>
        <Link to="/" className="btn-dark inline-block px-6 py-3">
          Back to home
        </Link>
      </div>
    </div>
  );
}