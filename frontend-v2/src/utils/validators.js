export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "At least 1 uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "At least 1 lowercase letter (a-z)", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "At least 1 digit (0-9)", test: (p) => /[0-9]/.test(p) },
  { id: "special", label: "At least 1 special character (!@#$%...)", test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export const checkPasswordStrength = (password) => {
  return PASSWORD_RULES.every((rule) => rule.test(password || ""));
};
