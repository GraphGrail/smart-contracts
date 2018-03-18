export const State = {
  New: 0,
  Active: 1,
  Finalized: 2,
}

State.stringify = stateToString

export function stateToString(number) {
  return ['New', 'Active', 'Finalized'][+number]
}


export function totalsToArrays(totalsMap) {
  const addresses = []
  const totals = []
  for(const key in totalsMap) {
    addresses.push(key)
    totals.push(totalsMap[key])
  }

  return {addresses, totals}
}

export function performanceToMap(performance) {
  const addresses = performance[0]
  const totals = performance[1]
  const approved = performance[2]
  const declined = performance[3]
  const len = addresses.length

  const result = {}

  for (let i = 0; i < len; ++i) {
    result[addresses[i]] = {
      'totalItems': totals[i].toString(),
      'approvedItems': approved[i].toString(),
      'declinedItems': declined[i].toString(),
    }
  }

  return result
}

export function performanceToArrays(performanceMap) {
  const addresses = []
  const approved = []
  const declined = []

  for(const key in performanceMap) {
    addresses.push(key)
    approved.push(performanceMap[key]['approvedItems'])
    declined.push(performanceMap[key]['declinedItems'])
  }

  return {addresses, approved, declined}
}
