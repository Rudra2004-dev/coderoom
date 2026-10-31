export interface RunOutput {
  text: string;
  isError: boolean;
}

export default function OutputPanel({ output, running }: { output: RunOutput | null; running: boolean }) {
  return (
    <aside className="h-full flex flex-col border border-gray-800 rounded bg-gray-900 overflow-hidden">
      <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">Output</div>
      <pre
        className={`flex-1 overflow-auto p-3 text-sm whitespace-pre-wrap ${
          output?.isError ? "text-red-400" : "text-gray-200"
        }`}
      >
        {running ? "Running..." : output ? output.text : "Click Run to execute your code."}
      </pre>
    </aside>
  );
}