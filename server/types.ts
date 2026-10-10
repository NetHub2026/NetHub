import type { Device } from "../src/lib/devices";
import type { ActivityEvent } from "../src/lib/activity";
import type { PatternState } from "../src/lib/patterns";
import type { UsageState } from "../src/lib/usage";
import type { HealthSample } from "../src/lib/health";
import type { SpeedResult } from "../src/lib/speedtest";
import type { FloorPlan } from "../src/lib/floor-plan";
import type { SentinelAlert } from "../src/lib/sentinel";
import type { AwayState } from "../src/lib/away";
import type { InventorySort, InventoryGroup } from "../src/lib/inventory-view";

export interface ServerSettings {
  ispName?: string;
  ispAuto?: boolean;
  awayAutoArm?: boolean;
  inventorySort?: InventorySort;
  inventoryGroup?: InventoryGroup;
  speedHistoryLimit: number;
  scanIntervalSeconds: number;
  healthIntervalSeconds: number;
  speedIntervalMinutes: number;
  interfaceName: string;
  contractedMbps: number;
  people: string[];
  locations: string[];
}
export interface NetworkInterface {
  name: string;
  address: string;
  cidr: string;
  gateway: string | null;
}
export interface ServerState {
  alerts?: SentinelAlert[];
  away?: AwayState;
  floorPlan?: FloorPlan | null;
  schema: 1;
  revision: number;
  devices: Device[];
  events: ActivityEvent[];
  patterns: PatternState;
  usage: UsageState;
  health: HealthSample[];
  speedHistory: SpeedResult[];
  settings: ServerSettings;
  lastScanAt: string | null;
  lastScanError: string | null;
  lastHealthError: string | null;
  lastSpeedError: string | null;
}
export interface ServerSnapshot extends ServerState {
  server: {
    version: string;
    startedAt: string;
    demo: boolean;
    scanning: boolean;
    speedRunning: boolean;
    speedProgress: { phase: string; value: number; progress: number } | null;
    interfaces: NetworkInterface[];
    traffic: { rxMbps: number; txMbps: number; available: boolean; at: number };
  };
}
