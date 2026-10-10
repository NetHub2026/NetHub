function shutdownArgs(ip, localIps = []) {
  const parts = String(ip).split(".");
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)) return null;
  const [a, b] = parts.map(Number);
  if (!(a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31) || ["0", "255"].includes(parts[3]) || localIps.includes(ip)) return null;
  // Zero timeout does not imply /f. Never force applications to close.
  return ["/s", "/m", `\\\\${ip}`, "/t", "0"];
}
module.exports = { shutdownArgs };
