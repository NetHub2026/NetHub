import type { DeviceType } from "@/lib/devices";
import { DeviceTypePicker } from "./DeviceTypePicker";

export function DeviceTypeFilter(props: {
  value: DeviceType[];
  onChange: (value: DeviceType[]) => void;
}) {
  return <DeviceTypePicker {...props} multiple />;
}
