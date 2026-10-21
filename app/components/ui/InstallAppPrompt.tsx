import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };

export function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* PWA enhancement must not break normal browsing. */ });
    }
    let dismissed = false;
    try { dismissed = window.sessionStorage.getItem("thakbo-install-dismissed") === "1"; } catch { /* storage may be disabled */ }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (!dismissed && !standalone) setVisible(true);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      if (!dismissed && !standalone) setVisible(true);
    };
    const onInstalled = () => { setVisible(false); setPromptEvent(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) { setIosHelp(true); return; }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setPromptEvent(null);
  }

  function dismiss() {
    setVisible(false); setIosHelp(false);
    try { window.sessionStorage.setItem("thakbo-install-dismissed", "1"); } catch { /* storage may be disabled */ }
  }

  if (!visible) return null;
  return <aside className="pwa-install-card" aria-label="Install THAKBO app">
    <div className="flex items-start gap-3">
      <img src="/icons/icon-192.png" alt="" width="44" height="44" className="shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Install THAKBO</p>
        <p className="mt-1 text-sm opacity-85">Add THAKBO to your home screen for quick access.</p>
        {iosHelp ? <p className="mt-2 text-sm">On iPhone/iPad, tap Share, then choose <strong>Add to Home Screen</strong>. On Android, use the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="pwa-install" onClick={install}>{promptEvent ? "Install app" : "How to install"}</button>
          <button type="button" className="pwa-dismiss" onClick={dismiss}>Not now</button>
        </div>
      </div>
      <button type="button" className="text-xl leading-none opacity-70" aria-label="Close install message" onClick={dismiss}>×</button>
    </div>
  </aside>;
}
