import { describe, expect, it } from "vitest";
import {
  normalizeManagedUsername,
  validateManagedProfilePayload,
  validateManagedUserForm,
  userValidationErrorMessage,
} from "./managedUserValidation";

describe("managed user validation contract", () => {
  it("normalizes usernames and Arabic numerals consistently", () => {
    expect(normalizeManagedUsername("  ADMIN_١٢  ")).toBe("admin_12");
  });

  it("accepts a valid hosted account and returns normalized fields", () => {
    expect(
      validateManagedUserForm({
        fullName: "  Mahmoud Hindam ",
        username: "  Manager.1 ",
        email: "  Manager@example.com ",
        phone: "+20 100 000 0000",
        password: "StrongPass123!",
        passwordConfirmation: "StrongPass123!",
        role: "manager",
        hosted: true,
        requirePassword: true,
        requirePasswordConfirmation: true,
      }),
    ).toEqual({
      fullName: "Mahmoud Hindam",
      username: "manager.1",
      email: "manager@example.com",
      phone: "+20 100 000 0000",
      password: "StrongPass123!",
      role: "manager",
    });
  });

  it("rejects usernames that do not match the database contract", () => {
    expect(() =>
      validateManagedUserForm({
        fullName: "A User",
        username: "ab",
        email: "a.user@example.com",
        password: "StrongPass123!",
        role: "cashier",
        hosted: true,
      }),
    ).toThrow(/اسم المستخدم/);
  });

  it("rejects invalid email before creating an Auth identity", () => {
    expect(() =>
      validateManagedUserForm({
        fullName: "A User",
        username: "a.user",
        email: "not-an-email",
        password: "StrongPass123!",
        role: "cashier",
        hosted: true,
        requirePassword: true,
      }),
    ).toThrow(/بريدًا إلكترونيًا/);
  });

  it("requires at least eight password characters and confirmation", () => {
    const input = {
      fullName: "A User",
      username: "a.user",
      email: "a.user@example.com",
      password: "1234567",
      passwordConfirmation: "1234567",
      role: "cashier",
      hosted: true,
      requirePassword: true,
      requirePasswordConfirmation: true,
    };

    expect(() => validateManagedUserForm(input)).toThrow(/8 أحرف/);
    expect(() =>
      validateManagedUserForm({
        ...input,
        password: "StrongPass123!",
        passwordConfirmation: "WrongPass123!",
      }),
    ).toThrow(/تأكيد كلمة المرور/);
  });

  it("rejects unsupported roles and oversized profile fields", () => {
    expect(() =>
      validateManagedUserForm({
        fullName: "A User",
        username: "a.user",
        role: "root",
        hosted: false,
      }),
    ).toThrow(/الدور الوظيفي/);

    expect(() =>
      validateManagedUserForm({
        fullName: "N".repeat(121),
        username: "a.user",
        role: "cashier",
        hosted: false,
      }),
    ).toThrow(/120 حرفًا/);
  });

  it("rejects non-boolean permission values before sending them to Supabase", () => {
    expect(() =>
      validateManagedProfilePayload({
        id: "auth-user-id",
        username: "cashier.1",
        full_name: "Cashier One",
        phone: "",
        role: "cashier",
        permissions: { pos_access: "true" },
      }),
    ).toThrow(/true أو false/);
  });

  it("translates database uniqueness errors into actionable Arabic", () => {
    expect(userValidationErrorMessage(new Error("USERNAME_ALREADY_EXISTS: duplicate"))).toBe(
      "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.",
    );
  });
});
