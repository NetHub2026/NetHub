import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
const { createDnsChecker } = createRequire(import.meta.url)("../../electron/dns-check.cjs");
afterEach(() => vi.useRealTimers());
function answer(query: Buffer, ip = [203, 0, 113, 10]) {
 const msg = Buffer.concat([query, Buffer.from([0xc0,0x0c,0,1,0,1,0,0,0,30,0,4,...ip])]);
 msg[2] = 0x81; msg[3] = 0x80; msg.writeUInt16BE(1,6); return msg;
}
function fixture(reply?: (socket: EventEmitter, query: Buffer, server: string) => void) {
 const sockets: Array<EventEmitter & {close: ReturnType<typeof vi.fn>}> = [];
 const create = () => { const socket = Object.assign(new EventEmitter(), { close: vi.fn(), send: (query: Buffer, _port: number, server: string, cb: (err: null) => void) => { cb(null); reply?.(socket,query,server); } }); sockets.push(socket); return socket; };
 return { ...createDnsChecker((ip: string) => ip === "192.168.50.1" ? ip : null, create), sockets };
}
it("termina y cierra el socket UDP cuando no hay respuesta", async () => {
 vi.useFakeTimers(); const f=fixture(); const promise=f.dnsQuery("192.168.50.1","example.com",1500);
 await vi.advanceTimersByTimeAsync(1500); expect(await promise).toEqual({ok:false,ips:[],rtt:null});
 expect(f.sockets[0]!.close).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});
it("acepta una respuesta válida y cancela el temporizador", async () => {
 vi.useFakeTimers(); const f=fixture((socket,q,server)=>socket.emit("message",answer(q),{address:server,port:53}));
 expect(await f.dnsQuery("192.168.50.1","example.com")).toMatchObject({ok:true,ips:["203.0.113.10"]});
 expect(vi.getTimerCount()).toBe(0); expect(f.sockets[0]!.close).toHaveBeenCalledTimes(1);
});
it("ignora mensajes ajenos o sin identificador correcto", async () => {
 vi.useFakeTimers(); const f=fixture((socket,q,server)=> { socket.emit("message",answer(q),{address:"203.0.113.20",port:53}); const wrong=answer(q); wrong.writeUInt16BE((q.readUInt16BE(0)+1)%65536,0); socket.emit("message",wrong,{address:server,port:53}); socket.emit("message",Buffer.alloc(2),{address:server,port:53}); });
 const promise=f.dnsQuery("192.168.50.1","example.com"); await vi.advanceTimersByTimeAsync(1500); expect((await promise).ok).toBe(false);
});
it("el error de socket también libera el temporizador", async () => {
 vi.useFakeTimers(); const f=fixture(socket=>socket.emit("error",new Error("UDP blocked")));
 expect((await f.dnsQuery("192.168.50.1","example.com")).ok).toBe(false); expect(vi.getTimerCount()).toBe(0);
});
it("no da por correcta una comparación si solo responde un servidor", async () => {
 vi.useFakeTimers(); const f=fixture((socket,q,server)=> { if(server === "8.8.8.8") socket.emit("message",answer(q),{address:server,port:53}); });
 const promise=f.dnsCheck("192.168.50.1","example.com"); await vi.advanceTimersByTimeAsync(1500);
 expect(await promise).toMatchObject({ok:false,hijacked:false,error:expect.stringContaining("router no respondió")});
});
it("compara ambas respuestas y detecta conjuntos diferentes", async () => {
 const f=fixture((socket,q,server)=>socket.emit("message",answer(q,server === "8.8.8.8" ? [203,0,113,20] : [203,0,113,10]),{address:server,port:53}));
 expect(await f.dnsCheck("192.168.50.1","example.com")).toMatchObject({ok:true,hijacked:true});
});
