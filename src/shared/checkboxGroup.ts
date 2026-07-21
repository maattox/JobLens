export function toggleCheckboxGroup<T extends string>(
  current: T[],
  option: T,
  noPreference: T
): T[] {
  if (option === noPreference) {
    return current.includes(noPreference) ? [] : [noPreference];
  }

  const withoutNoPref = current.filter((value) => value !== noPreference);
  if (withoutNoPref.includes(option)) {
    const next = withoutNoPref.filter((value) => value !== option);
    return next.length === 0 ? [noPreference] : next;
  }

  return [...withoutNoPref, option];
}
