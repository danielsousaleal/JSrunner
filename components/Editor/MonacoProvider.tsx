"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="flex flex-col items-center gap-4">
        <div className="size-8 animate-spin rounded-full border-2 border-[#007acc] border-t-transparent" />
        <span className="text-sm">Loading editor...</span>
      </div>
    </div>
  ),
});

export default MonacoEditor;
