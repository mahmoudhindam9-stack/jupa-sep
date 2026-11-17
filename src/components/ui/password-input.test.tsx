import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(" "),
}));

import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("toggles input type between password and text when clicking the eye button", () => {
    render(<PasswordInput placeholder="••••••••" defaultValue="MySecret123" />);

    const input = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    const toggleBtn = screen.getByRole("button", { name: "إظهار كلمة المرور" });

    expect(input.type).toBe("password");
    expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggleBtn);
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "إخفاء كلمة المرور" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "إخفاء كلمة المرور" }));
    expect(input.type).toBe("password");
  });

  it("prevents mousedown default so clicking the eye toggle does not blur the input", () => {
    render(<PasswordInput placeholder="pass-focus" />);
    const toggleBtn = screen.getByRole("button", { name: "إظهار كلمة المرور" });
    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    toggleBtn.dispatchEvent(mouseDownEvent);
    expect(mouseDownEvent.defaultPrevented).toBe(true);
  });

  it("supports controlled visibility state across paired inputs", () => {
    function PairedPasswords() {
      const [visible, setVisible] = useState(false);
      return (
        <div>
          <PasswordInput placeholder="p1" visible={visible} onVisibleChange={setVisible} />
          <PasswordInput placeholder="p2" visible={visible} onVisibleChange={setVisible} />
        </div>
      );
    }

    render(<PairedPasswords />);
    const p1 = screen.getByPlaceholderText("p1") as HTMLInputElement;
    const p2 = screen.getByPlaceholderText("p2") as HTMLInputElement;
    const buttons = screen.getAllByRole("button", { name: "إظهار كلمة المرور" });

    expect(p1.type).toBe("password");
    expect(p2.type).toBe("password");

    fireEvent.click(buttons[0]);

    expect(p1.type).toBe("text");
    expect(p2.type).toBe("text");
  });
});
