## Summary

-

## Linked Issue

Closes #

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

## AFK Agent Gate

- [ ] Planner produced done-when criteria.
- [ ] Implementer completed each phase with lint, test, and build green before moving on.
- [ ] Reviewer verdict is PASS.
- [ ] Any planner assumptions were resolved before implementation.

## Safety Checklist

- [ ] Existing API response shapes are unchanged unless the issue allowed an additive change.
- [ ] No database was added.
- [ ] No new dependency was added without approval.
- [ ] `src/types/task.ts` was not edited unless the issue explicitly required it.
- [ ] `docs/API.md` was updated if endpoint behavior changed.
- [ ] `docs/LABS.md` was updated if lab instructions changed.
