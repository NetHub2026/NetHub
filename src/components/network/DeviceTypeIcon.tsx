import {
  Camera,
  Gamepad2,
  HouseWifi,
  Laptop,
  Lightbulb,
  Monitor,
  Network,
  PlugZap,
  Printer,
  Radio,
  Router,
  Server,
  Smartphone,
  Sparkles,
  Speaker,
  Tablet,
  Tv,
  Tv2,
} from "lucide-react";
import type { DeviceType } from "@/lib/devices";
import { normalizeDeviceType } from "@/lib/devices";
import { cn } from "@/lib/utils";

/** Icono por tipo de dispositivo, compartido por tarjetas, filtros y detalle. */
export const deviceTypeIcons: Record<DeviceType, React.ComponentType<{ className?: string }>> = {
  pc: Monitor,
  laptop: Laptop,
  smartphone: Smartphone,
  tablet: Tablet,
  tv: Tv,
  "set-top-box": Tv2,
  console: Gamepad2,
  "home-assistant": HouseWifi,
  router: Router,
  nas: Server,
  printer: Printer,
  camera: Camera,
  "smart-plug": PlugZap,
  "smart-bulb": Lightbulb,
  "led-strip": Sparkles,
  speaker: Speaker,
  iot: Radio,
  other: Network,
};

export function DeviceTypeIcon({
  type,
  className,
}: {
  type: DeviceType;
  className?: string;
}) {
  const Icon = deviceTypeIcons[type] ?? deviceTypeIcons[normalizeDeviceType(type)] ?? Network;
  return <Icon className={cn("size-4", className)} />;
}
