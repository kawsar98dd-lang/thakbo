import { useEffect, useState } from "react";

function getTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => { setTheme(getTheme()); }, []);
  function toggle() {
    const next = getTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem("thakbo-theme", next); } catch { /* storage may be unavailable */ }
    setTheme(next);
  }
  return <button type="button" onClick={toggle} className="theme-toggle" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to cyberpunk dark theme"} title={theme === "dark" ? "Light theme" : "Cyberpunk dark theme"}>
    <span aria-hidden="true" className="text-lg leading-none">{theme === "dark" ? "☀" : "☾"}</span><span className="hidden xl:inline">{theme === "dark" ? "Light" : "Dark"}</span>
  </button>;
}
