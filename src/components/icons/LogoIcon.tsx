import type React from 'react';

const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 50"
    width="150"
    height="30"
    aria-label="Multi-Regional Chat Mate Logo"
    {...props}
  >
    <style>
      {`
        .logo-text {
          font-family: 'Inter', sans-serif;
          font-size: 24px;
          font-weight: 600;
          fill: hsl(var(--primary-foreground));
        }
        .logo-highlight {
          fill: hsl(var(--primary));
        }
        @media (prefers-color-scheme: dark) {
          .logo-text {
            fill: hsl(var(--primary-foreground));
          }
        }
      `}
    </style>
    <rect className="logo-highlight" width="40" height="40" rx="8" ry="8" x="5" y="5"/>
    <text x="15" y="30" className="logo-text" fill="white">MR</text>
    <text x="55" y="32" className="logo-text">
      Chat Mate
    </text>
  </svg>
);

export default LogoIcon;
