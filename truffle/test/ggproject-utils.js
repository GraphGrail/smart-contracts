export const States = {
  New: 0,
  Active: 1,
  Finalized: 2,
}

States.stringify = stateToString

export function stateToString(number) {
  return ['New', 'Active', 'Finalized'][+number]
}
