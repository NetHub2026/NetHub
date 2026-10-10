import { expect, it } from "vitest";
import { diffActivity } from "./activity";
import { parseHostsJson } from "./scanner";
import { unifyDevices } from "./device-unification";
it("registra cambios del equipo conocido sin presentarlo como nuevo", () => {
 const [a,b] = parseHostsJson([{ip:"192.168.50.20",mac:"02:00:00:00:00:01"},{ip:"192.168.60.20",mac:"02:00:00:00:00:02"}]);
 const old = unifyDevices([a!,b!],a!.id,b!.id)[0]!;
 const next = {...old, mac:b!.mac, ip:"192.168.60.21",tags:["Wi-Fi 5GHz"],connectionSource:"manual" as const};
 const events = diffActivity([{...old,mac:a!.mac,tags:["Cableado / Ethernet"],connectionSource:"manual"}], [next]);
 expect(events.map(e=>e.kind)).toEqual(["ip_changed","connection_changed","mac_changed"]);
 expect(events.find(e=>e.kind==="connection_changed")?.detail).toContain("5 GHz");
});
it("no inventa cambios de conexión con etiquetas antiguas sin confirmar", () => {
 const [d] = parseHostsJson([{ip:"192.168.50.20",mac:"02:00:00:00:00:01"}]);
 expect(diffActivity([{...d!,tags:["Wi-Fi"]}], [{...d!,tags:["Cableado / Ethernet"]}])).toEqual([]);
});
