import React from "react";

export interface ChefDishIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Clear Chef-with-a-Dish icon (طاهٍ يحمل طبق تقديم / كلوش) for meal/item selection and Add-to-Dish actions.
 */
export const ChefDishIcon: React.FC<ChefDishIconProps> = ({
  size = 18,
  className = "",
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Chef Toque (Hat) */}
      <path d="M6 10V8a3 3 0 0 1 .3-1.3A3.5 3.5 0 0 1 9.5 2a3.8 3.8 0 0 1 5 0 3.5 3.5 0 0 1 3.2 4.7c.2.4.3.8.3 1.3v2" />
      <path d="M6 10h12" />
      {/* Serving Cloche / Dish Dome & Platter */}
      <path d="M12 12v1" />
      <path d="M5 18a7 7 0 0 1 14 0" />
      <path d="M3 18h18" />
      <path d="M4 21h16" />
    </svg>
  );
};

export default ChefDishIcon;
