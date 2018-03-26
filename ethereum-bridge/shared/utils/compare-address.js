
export default function compareAddress(first, second) {
  if (!first && !second) {
    return true
  }
  if (!first || !second) {
    return false
  }
  return first.toLowerCase() === second.toLowerCase()
}
