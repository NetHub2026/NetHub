function interfaceConnectionTag(name = "") {
  const text = String(name).toLowerCase();
  if (/wi-?fi|wireless|wlan|802\.11|inal[aá]mbrica/.test(text)) return "Wi-Fi";
  if (/ethernet|802\.3|\bgbe\b|\bcable\b/.test(text)) return "Cableado / Ethernet";
  return null;
}
function wifiTagForMac(output, mac) {
  const clean = String(mac).replace(/[:-]/g, "").toLowerCase();
  if (!/^[a-f0-9]{12}$/.test(clean)) return null;
  const blocks = String(output).split(/(?=^\s*(?:Name|Nombre)\s*:)/mi);
  for (const block of blocks) {
    const found = block.match(/(?:Physical address|Direcci[oó]n f[ií]sica)\s*:\s*([a-f0-9:-]{17})/i)?.[1];
    if (!found || found.replace(/[:-]/g, "").toLowerCase() !== clean) continue;
    const band = block.match(/^\s*(?:Band|Banda)\s*:\s*(2[.,]4|5|6)\s*GHz\s*$/mi)?.[1]?.replace(",", ".");
    // Channel alone is ambiguous between 2.4 and 6 GHz; Wi-Fi 6 is not a band.
    return band ? `Wi-Fi ${band}GHz` : "Wi-Fi";
  }
  return null;
}
module.exports = { interfaceConnectionTag, wifiTagForMac };
