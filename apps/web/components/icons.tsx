/**
 * Tiny inline icon set — stroke-based, 1.5px, neutral.
 * Ported from docs/design/nexus/src/icons.jsx.
 */
import type { CSSProperties, SVGProps } from "react";

export type IconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
} & Omit<SVGProps<SVGSVGElement>, "ref">;

type RawIconProps = IconProps & { d: string };

const RawIcon = ({
  d,
  size = 16,
  stroke = "currentColor",
  strokeWidth = 1.5,
  fill = "none",
  ...rest
}: RawIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    <path d={d} />
  </svg>
);

export const IconPlay = (p: IconProps) => (
  <RawIcon {...p} d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none" />
);
export const IconCode = (p: IconProps) => (
  <RawIcon {...p} d="M9 8l-5 4 5 4 M15 8l5 4-5 4 M14 4l-4 16" />
);
export const IconBulb = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M9 18h6 M10 21h4 M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.6-1 2.5v.5H9v-.5c0-1-.3-1.8-1-2.5A6 6 0 0 1 12 3z"
  />
);
export const IconMic = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3"
  />
);
export const IconMicOff = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M3 3l18 18 M9 9v2a3 3 0 0 0 5.1 2.1 M15 11V5a3 3 0 0 0-6 0v.5 M5 11a7 7 0 0 0 11.7 5.2 M12 18v3 M19 11a7 7 0 0 1-1.5 4.3"
  />
);
export const IconPhone = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2z"
  />
);
export const IconCog = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1A2 2 0 1 1 7 4l.1.1a1.7 1.7 0 0 0 1.9.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
  />
);
export const IconDownload = (p: IconProps) => (
  <RawIcon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
);
export const IconCopy = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2 M4 16h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"
  />
);
export const IconLock = (p: IconProps) => (
  <RawIcon {...p} d="M5 11h14v10H5z M8 11V7a4 4 0 1 1 8 0v4" />
);
export const IconArrow = (p: IconProps) => (
  <RawIcon {...p} d="M5 12h14 M13 6l6 6-6 6" />
);
export const IconBolt = (p: IconProps) => (
  <RawIcon {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
);
export const IconShield = (p: IconProps) => (
  <RawIcon {...p} d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
);
export const IconGlobe = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18"
  />
);
export const IconChevron = (p: IconProps) => (
  <RawIcon {...p} d="M9 6l6 6-6 6" />
);
export const IconClose = (p: IconProps) => (
  <RawIcon {...p} d="M6 6l12 12 M6 18L18 6" />
);
export const IconFile = (p: IconProps) => (
  <RawIcon {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6" />
);
export const IconFolder = (p: IconProps) => (
  <RawIcon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
);
export const IconSparkle = (p: IconProps) => (
  <RawIcon
    {...p}
    d="M12 3v4 M12 17v4 M3 12h4 M17 12h4 M5.6 5.6l2.8 2.8 M15.6 15.6l2.8 2.8 M5.6 18.4l2.8-2.8 M15.6 8.4l2.8-2.8"
  />
);
