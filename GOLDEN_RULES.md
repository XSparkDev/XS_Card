# Golden Rules for Integration

## Rule #1: Never Make Assumptions
**Always ask, never assume.** It's better to ask a question than to assume a detail that will cause backtracking and rework.

If you're unsure about any detail, implementation approach, or context - **ASK FIRST**.

---

## Rule #2: Poop/Concrete Principles
**Cement/Poop Principle:** Identify stable code (cement) - don't modify it. Build small testable pieces (poop) alongside it. Test each piece. If issues found, revert to cement and fix. Repeat until stable (becomes new cement). Reuse cement infrastructure without changing it.

**Key Points:**
- **Cement** = Stable, tested code that works - DO NOT MODIFY
- **Poop** = New code being built alongside cement - testable, incremental
- Test each piece before proceeding
- If issues found, revert to cement and fix
- Once stable, poop becomes new cement
- Reuse cement infrastructure without changing it

**Applied to Integration:**
- Current payment/subscription code = CEMENT (don't modify)
- Enterprise document creation = POOP (new, alongside cement)
- Test incrementally
- If issues, revert and fix

---

## Rule #3: No Dummy or Mock Data
**NEVER make use of dummy or mock data in implementation or in testing.**

All data used must be real, valid, and representative of actual production scenarios. This ensures:
- Tests reflect real-world behavior
- Implementation handles actual data structures
- No surprises when code hits production
- Real edge cases are discovered during development

**Applied to Integration:**
- Use real quote data structures
- Use real account data structures
- Test with actual Firestore document structures
- No placeholder values or mock objects

---
