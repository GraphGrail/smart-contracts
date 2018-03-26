export const State = {
  New: 0,
  Active: 1,
  Finalized: 2,
}

State.stringify = stateToString

export function stateToString(state) {
  switch (state) {
    case 0: return 'New'
    case 1: return 'Active'
    case 2: return 'Finalized'
    default: throw new Error(`Invalid contract state: ${state}`)
  }
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
      totalItems: +totals[i],
      approvedItems: +approved[i],
      declinedItems: +declined[i],
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

export function describeToMap(rawDescribe) {
  const [state, totalWorkItems, workItemPrice, tokenBalance,
    workItemsBalance, workItemsLeft, requiredInitialTokenBalance,
    canFinalize, canForceFinalize, canForceFinalizeAt] = rawDescribe
  return {
    state: +state,
    totalWorkItems: +totalWorkItems,
    workItemPrice: workItemPrice,
    tokenBalance: tokenBalance,
    workItemsBalance: +workItemsBalance,
    workItemsLeft: +workItemsLeft,
    requiredInitialTokenBalance: requiredInitialTokenBalance,
    canFinalize: canFinalize,
    canForceFinalize: canForceFinalize,
    canForceFinalizeAt: +canForceFinalizeAt,
  }
}

export async function getContractStatus(contract) {
  const [rawDescribe, rawPerformance, client, owner] = await Promise.all([
    contract.describe(), contract.getPerformance(), contract.client(), contract.owner()])
  return {
    ...describeToMap(rawDescribe),
    client,
    owner,
    performance: performanceToMap(rawPerformance),
  }
}

