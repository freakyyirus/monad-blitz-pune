import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & {
  showWordmark?: boolean;
};

export function Logo({ showWordmark = false, ...props }: LogoProps) {
  const { width = 28, height = 28, ...rest } = props;
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={width}
        height={height}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="MonQuest"
        {...rest}
      >
        <defs>
          <linearGradient id="mq-m" x1="6" y1="27" x2="26" y2="5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#16A34A" />
            <stop offset="1" stopColor="#15803D" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="#0F0F10" />
        <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" stroke="#2A2A2D" strokeWidth="1" />
        <path
          d="M7 24V11.2L16 20l9-8.8V24"
          stroke="url(#mq-m)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23.2 8.2c.1-2.4 2-4.3 4.4-4.4"
          stroke="#16A34A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="28.4" cy="6.4" r="1.6" fill="#34D399" />
      </svg>
      {showWordmark && (
        <span className="text-sm font-semibold tracking-tight text-[#FAFAFA]">MonQuest</span>
      )}
    </span>
  );
}

export default Logo;