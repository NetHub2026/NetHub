import {
  Apple,
  Camera,
  Cpu,
  Gamepad2,
  HardDrive,
  HouseWifi,
  Lightbulb,
  Monitor,
  Network,
  Plug,
  Printer,
  Router,
  ShoppingBag,
  Thermometer,
  Tv,
  Wifi,
} from "lucide-react";
import type { VendorBrand } from "@/lib/oui";
import { cn } from "@/lib/utils";

const brandIcons: Record<VendorBrand, React.ReactNode> = {
  apple: <Apple className="size-4" />,
  sony: <Gamepad2 className="size-4" />,
  nintendo: <Gamepad2 className="size-4" />,
  microsoft: <Gamepad2 className="size-4" />,
  samsung: <Tv className="size-4" />,
  lg: <Tv className="size-4" />,
  espressif: <Cpu className="size-4" />,
  shelly: <Plug className="size-4" />,
  intel: <Cpu className="size-4" />,
  raspberry: <HouseWifi className="size-4" />,
  "tp-link": <Router className="size-4" />,
  asus: <Monitor className="size-4" />,
  google: <Wifi className="size-4" />,
  amazon: <ShoppingBag className="size-4" />,
  xiaomi: <Plug className="size-4" />,
  philips: <Lightbulb className="size-4" />,
  aqara: <Network className="size-4" />,
  tado: <Thermometer className="size-4" />,
  reolink: <Camera className="size-4" />,
  valve: <Gamepad2 className="size-4" />,
  ubiquiti: <Router className="size-4" />,
  netgear: <Router className="size-4" />,
  avm: <Router className="size-4" />,
  huawei: <Wifi className="size-4" />,
  realtek: <Cpu className="size-4" />,
  sercomm: <Router className="size-4" />,
  sagemcom: <Router className="size-4" />,
  tuya: <Plug className="size-4" />,
  hp: <Printer className="size-4" />,
  dell: <Monitor className="size-4" />,
  lenovo: <Monitor className="size-4" />,
  roku: <Tv className="size-4" />,
  sonos: <Wifi className="size-4" />,
  synology: <HardDrive className="size-4" />,
  canon: <Printer className="size-4" />,
  epson: <Printer className="size-4" />,
  brother: <Printer className="size-4" />,
  hikvision: <Camera className="size-4" />,
  dahua: <Camera className="size-4" />,
  honor: <Wifi className="size-4" />,
  oppo: <Wifi className="size-4" />,
  oneplus: <Wifi className="size-4" />,
  unknown: <Network className="size-4" />,
};

export function VendorIcon({
  brand,
  className,
}: {
  brand: VendorBrand | undefined;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      {brandIcons[brand ?? "unknown"]}
    </span>
  );
}
