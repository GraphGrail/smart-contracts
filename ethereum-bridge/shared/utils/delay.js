export default function delay(tiemoutMs, value) {
  return new Promise(resolve => setTimeout(() => resolve(value), tiemoutMs))
}
