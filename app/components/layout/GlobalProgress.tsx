import { useNavigation } from "react-router";

/** Thin progress bar at the top of the page while a navigation or form submission is in flight. */
export function GlobalProgress() {
  const navigation = useNavigation();
  if (navigation.state === "idle") return null;
  return (
    <div role="progressbar" aria-label="Loading page" className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-brand-100">
      <div className="h-full w-1/3 animate-pulse bg-brand-600" />
    </div>
  );
}
