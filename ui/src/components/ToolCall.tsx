import { useState } from "react";

interface Props {
  name: string;
  args: Record<string, unknown>;
}

export default function ToolCall({ name, args }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="tool-call">
      <button className="tool-header" onClick={() => setOpen((o) => !o)}>
        <span className="tool-header-icon">⚙</span>
        <span className="tool-header-name">{name}</span>
        <span className="tool-header-caret">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre className="tool-body">{JSON.stringify(args, null, 2)}</pre>
      )}
    </div>
  );
}
