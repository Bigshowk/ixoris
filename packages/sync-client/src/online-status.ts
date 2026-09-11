export function subscribeOnlineStatus(onChange: (online: boolean) => void): () => void {
  const goOnline = () => onChange(true);
  const goOffline = () => onChange(false);
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
  };
}
