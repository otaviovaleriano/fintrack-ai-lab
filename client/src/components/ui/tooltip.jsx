import * as React from "react";

export function Tooltip({ children }) {
  return <div className="relative">{children}</div>;
}

export function TooltipTrigger({ children, asChild }) {
  return children;
}

export function TooltipContent({ children }) {
  return (
    <div className="absolute top-full left-0 mt-2 px-3 py-2 rounded-md bg-black text-white text-sm z-10 shadow-lg">
      {children}
    </div>
  );
}
