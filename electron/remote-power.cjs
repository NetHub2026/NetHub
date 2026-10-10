function shutdownArgs(ip, localIps = []) {
  const parts = String(ip).split(".");
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)) return null;
  const [a, b] = parts.map(Number);
  if (!(a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31) || ["0", "255"].includes(parts[3]) || localIps.includes(ip)) return null;
  // Zero timeout does not imply /f. Never force applications to close.
  return ["/s", "/m", `\\\\${ip}`, "/t", "0"];
}
function shutdownError(error, stderr = "", stdout = "") {
  if (error?.killed || error?.code === "ETIMEDOUT") return "Windows no respondió a tiempo. No se ha confirmado el apagado; comprueba el estado del PC antes de volver a solicitarlo.";
  const detail = String(stderr || stdout).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 600);
  return detail
    ? `Windows rechazó la solicitud: ${detail}. El PC de destino debe permitir el apagado remoto con tu cuenta de Windows.`
    : "Windows rechazó la solicitud. Comprueba que el PC sea Windows, tenga permisos de apagado remoto y permita la administración remota.";
}
module.exports = { shutdownArgs, shutdownError };
