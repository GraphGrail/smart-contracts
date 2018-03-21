const id = x => x

export default function mapObject(obj, valueMapper = id, keyMapper = id) {
  let result = {}
  for (let key in obj) {
    const mappedKey = keyMapper(key)
    const mappedValue = valueMapper(obj[key], key, mappedKey)
    if (mappedValue !== undefined) {
      result[mappedKey] = mappedValue
    }
  }
  return result
}
