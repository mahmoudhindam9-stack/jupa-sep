/**
 * Safe arithmetic parser for Studio actions.
 * Accepts only numbers, parentheses, + - * / %, and variables a/b.
 * Never evaluates user text as JavaScript.
 */
export function evaluateSafeFormula(
  expression: string,
  variables: Record<string, number> = {},
): number {
  const source = String(expression || "").trim();
  if (!source || source.length > 240) throw new Error("اكتب معادلة قصيرة وصحيحة.");

  const tokens: string[] = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    const remainder = source.slice(index);
    const match = remainder.match(/^(?:\d+(?:\.\d*)?|\.\d+)|^[a-zA-Z_][a-zA-Z0-9_]*|^[()+\-*/%]/);
    if (!match) throw new Error("المعادلة تحتوي على رمز غير مدعوم.");
    tokens.push(match[0]);
    index += match[0].length;
  }

  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = take();
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const operator = take();
      const right = parseFactor();
      if ((operator === "/" || operator === "%") && right === 0) {
        throw new Error("لا يمكن القسمة على صفر.");
      }
      if (operator === "*") value *= right;
      else if (operator === "/") value /= right;
      else value %= right;
    }
    return value;
  };
  const parseFactor = (): number => {
    const token = peek();
    if (token === "+" || token === "-") {
      take();
      const value = parseFactor();
      return token === "-" ? -value : value;
    }
    if (token === "(") {
      take();
      const value = parseExpression();
      if (take() !== ")") throw new Error("أغلق القوس في نهاية الجزء الحسابي.");
      return value;
    }
    if (!token) throw new Error("المعادلة غير مكتملة.");
    take();
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return Number(token);
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      const value = variables[token.toLowerCase()];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("اختر العنصر الذي سيغذي القيمة " + token + ".");
      }
      return value;
    }
    throw new Error("جزء غير صالح في المعادلة.");
  };

  const result = parseExpression();
  if (cursor !== tokens.length || !Number.isFinite(result)) {
    throw new Error("تعذر حساب المعادلة؛ راجع الأرقام والعمليات.");
  }
  return result;
}

export function getStudioNumericValue(selector: string | undefined): number {
  if (!selector || typeof document === "undefined") return 0;
  let element: Element | null = null;
  try {
    element = document.querySelector(selector);
  } catch {
    return 0;
  }
  if (!element) return 0;
  const raw = "value" in element
    ? String((element as HTMLInputElement).value || "")
    : String(element.textContent || "");
  const normalized = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

export function writeStudioResult(selector: string | undefined, value: string): boolean {
  if (!selector || typeof document === "undefined") return false;
  let element: Element | null = null;
  try {
    element = document.querySelector(selector);
  } catch {
    return false;
  }
  if (!element) return false;
  if ("value" in element) {
    (element as HTMLInputElement).value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    element.textContent = value;
  }
  return true;
}

export function runStudioAction(action: any): void {
  if (!action || typeof action !== "object") return;
  switch (action.type) {
    case "navigate": {
      const destination = String(action.destination || "");
      if (destination.startsWith("/") && !destination.startsWith("//")) {
        window.location.assign(destination);
      }
      break;
    }
    case "message":
      window.alert(String(action.message || "تم تنفيذ الإجراء."));
      break;
    case "toggle": {
      const target = document.querySelector(String(action.targetSelector || ""));
      if (!target) return;
      const node = target as HTMLElement;
      const isHidden = node.dataset.studioFlowHidden === "true";
      if (!isHidden) {
        node.dataset.studioFlowPreviousDisplay = node.style.display;
        node.style.display = "none";
        node.dataset.studioFlowHidden = "true";
      } else {
        node.style.display = node.dataset.studioFlowPreviousDisplay || "";
        delete node.dataset.studioFlowHidden;
        delete node.dataset.studioFlowPreviousDisplay;
      }
      break;
    }
    case "set_value": {
      writeStudioResult(action.targetSelector, String(action.value ?? ""));
      break;
    }
    case "calculate": {
      const a = getStudioNumericValue(action.leftSelector);
      const b = getStudioNumericValue(action.rightSelector);
      let result: number;
      if (action.formula) {
        result = evaluateSafeFormula(String(action.formula), { a, b });
      } else {
        const operator = ["+", "-", "*", "/", "%"].includes(action.operator) ? action.operator : "+";
        if ((operator === "/" || operator === "%") && b === 0) throw new Error("لا يمكن القسمة على صفر.");
        if (operator === "+") result = a + b;
        else if (operator === "-") result = a - b;
        else if (operator === "*") result = a * b;
        else if (operator === "/") result = a / b;
        else result = a % b;
      }
      writeStudioResult(action.resultSelector, String(Number(result.toFixed(6))));
      break;
    }
  }
}
