import * as React from "react";

const BurgerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="28"
    height="22"
    viewBox="0 0 28 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M2 19.5416H25.9167M2 10.9999H25.9167M2 2.45825H25.9167"
      stroke="currentColor" // makes stroke inherit text color
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default BurgerIcon;
