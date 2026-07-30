import type { LeaveStatus } from "@/types";

interface Props {
  status: LeaveStatus;
  size?: "sm" | "md";
}

const config: Record<LeaveStatus, { label: string; classes: string; dot: string }> = {
  PENDING: {
    label: "Pending",
    classes: "bg-yellow-50 text-yellow-800 border border-yellow-200",
    dot: "bg-yellow-400",
  },
  APPROVED: {
    label: "Approved",
    classes: "bg-green-50 text-green-800 border border-green-200",
    dot: "bg-green-500",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-50 text-red-800 border border-red-200",
    dot: "bg-red-500",
  },
  CANCELLED: {
    label: "Cancelled",
    classes: "bg-gray-100 text-gray-600 border border-gray-200",
    dot: "bg-gray-400",
  },
};

export default function StatusBadge({ status, size = "sm" }: Props) {
  const { label, classes, dot } = config[status];
  const padding = size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padding} ${classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
