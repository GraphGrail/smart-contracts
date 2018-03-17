export const State = {
  New: 0,
  Active: 1,
  Finalized: 2,
}

State.stringify = stateToString

export function stateToString(number) {
  return ['New', 'Active', 'Finalized'][+number]
}
