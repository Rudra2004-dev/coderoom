export default function QuestionPanel() {
  return (
    <aside className="h-full overflow-auto border border-gray-800 rounded bg-gray-900 p-4 space-y-3">
      <h2 className="font-bold">Two Sum</h2>
      <span className="text-xs bg-green-900 text-green-300 rounded px-2 py-0.5">Easy</span>
      <p className="text-sm text-gray-300">
        Given an array of integers and a target, print the indices of the two numbers that add up to the target.
      </p>
      <div className="text-xs text-gray-400">
        <p className="font-semibold text-gray-300">Input format</p>
        <p>Line 1: the array, space separated</p>
        <p>Line 2: the target</p>
      </div>
      <div className="text-xs text-gray-400">
        <p className="font-semibold text-gray-300">Example</p>
        <pre className="bg-gray-950 rounded p-2 mt-1">{`2 7 11 15\n9\n→ 0 1`}</pre>
      </div>
    </aside>
  );
}