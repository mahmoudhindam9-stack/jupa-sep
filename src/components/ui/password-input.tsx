import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  containerClassName?: string;
  toggleButtonClassName?: string;
  showLabel?: string;
  hideLabel?: string;
  iconSizeClassName?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      containerClassName,
      toggleButtonClassName,
      visible,
      onVisibleChange,
      dir = "ltr",
      showLabel = "إظهار كلمة المرور",
      hideLabel = "إخفاء كلمة المرور",
      iconSizeClassName = "w-4 h-4",
      disabled,
      ...props
    },
    ref,
  ) => {
    const [internalVisible, setInternalVisible] = React.useState(false);
    const isControlled = typeof visible === "boolean";
    const isVisible = isControlled ? visible : internalVisible;

    const handleToggle = () => {
      const next = !isVisible;
      if (!isControlled) {
        setInternalVisible(next);
      }
      onVisibleChange?.(next);
    };

    const isRtlInput = dir === "rtl";

    return (
      <div className={cn("relative flex items-center", containerClassName)}>
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          dir={dir}
          disabled={disabled}
          className={cn(
            "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
            isRtlInput ? "pl-10" : "pr-10",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggle}
          aria-pressed={isVisible}
          aria-label={isVisible ? hideLabel : showLabel}
          title={isVisible ? hideLabel : showLabel}
          className={cn(
            "absolute inset-y-0 z-20 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:text-foreground transition-colors cursor-pointer select-none pointer-events-auto [&_svg]:pointer-events-none",
            isRtlInput ? "left-0" : "right-0",
            toggleButtonClassName,
          )}
        >
          {isVisible ? (
            <EyeOff className={iconSizeClassName} aria-hidden="true" />
          ) : (
            <Eye className={iconSizeClassName} aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
