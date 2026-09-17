import {
  Camera,
  Gamepad2,
  HouseWifi,
  Laptop,
  Network,
  Printer,
  Radio,
  Router,
  Smartphone,
  Speaker,
  Tv,
} from "lucide-react";
import type { DeviceType } from "@/lib/devices";
import { cn } from "@/lib/utils";

/** Icono por tipo de dispositivo, compartido por tarjetas, filtros y detalle. */
export const deviceTypeIcons: Record<DeviceType, React.ComponentType<{ className?: string }>> = {
  pc: Laptop,
  phone: Smartphone,
  tv: Tv,
  console: Gamepad2,
  "home-assistant": HouseWifi,
  router: Router,
  printer: Printer,
  camera: Camera,
  iot: Radio,
  speaker: Speaker,
  other: Network,
};

export function DeviceTypeIcon({
  type,
  className,
}: {
  type: DeviceType;
  className?: string;
}) {
  const Icon = deviceTypeIcons[type] ?? Network;
  return <Icon className={cn("size-4", className)} />;
}
