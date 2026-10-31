export interface RunOutput {
  text: string;
  isError: boolean;
}

interface Props {
  output: RunOutput | null;
  running: boolean;
  stdin: string;
  onStdinChange: (value: string) => void;
}

export default function OutputPanel({ output, running, stdin, onStdinChange }: Props) {
  return (
    <aside className="h-full flex flex-col border border-gray-800 rounded bg-gray-900 overflow-hidden">
      <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">Input (stdin)</div>
      <textarea
        value={stdin}
        onChange={(e) => onStdinChange(e.target.value)}
        placeholder="Optional input for your program"
        className="h-24 resize-none bg-gray-950 p-3 text-sm text-gray-200 outline-none border-b border-gray-800"
      />
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