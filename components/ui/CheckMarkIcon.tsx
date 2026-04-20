import React from "react";

interface CheckMarkIconProps {
  size?: number;
  color?: string;
}

export default function CheckMarkIcon({ size = 14, color = "currentColor" }: CheckMarkIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 13.5L18.5 4L22 7.5L9.05883 20L2 13.353L5 10L9 13.5Z"
        fill={color}
      />
    </svg>
  );
}
